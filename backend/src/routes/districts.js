const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const AMap_KEY = '73a8a319f0d57ac4ebcd62c6c526b6f4';
const CACHE_DAYS = 7;

function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next();  // 允许未授权请求
  }
  const parts = authHeader.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return next();
  }
  return next();
}

router.use(auth);

async function syncDistrictsFromAmap(parentAdcode = '100000', level = 'province', parentCode = null) {
  // For provinces, use subdistrict=2 to get both cities and districts in one call
  const subdistrict = (level === 'province' || level === 'province_sync') ? 2 : 2;
  const url = `https://restapi.amap.com/v3/config/district?key=${AMap_KEY}&keywords=${parentAdcode}&subdistrict=${subdistrict}&extensions=base`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== '1') {
    throw new Error(data.info || 'API返回错误');
  }
  
  const districts = data.districts?.[0]?.districts || [];
  
  for (const district of districts) {
    const apiLevel = district.level;
    // Skip country level, but handle street level (for direct-controlled cities)
    if (apiLevel === 'country') {
      continue;
    }
    
    // Determine the correct level based on adcode pattern
    let currentLevel;
    if (apiLevel === 'province') {
      currentLevel = 'province';
    } else if (apiLevel === 'city') {
      currentLevel = 'city';
    } else if (apiLevel === 'street') {
      // For direct-controlled cities, street-level items are actually towns
      currentLevel = 'town';
    } else {
      currentLevel = 'district';
    }
    
    // parentCode should be the adcode of the parent (passed as parameter)
    const actualParentCode = parentAdcode === '100000' ? null : parentAdcode;
    
    await pool.execute(
      'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
      [district.adcode, district.name, currentLevel, actualParentCode]
    );
    
    // Recursively sync children if they exist
    if (district.districts && district.districts.length > 0) {
      for (const city of district.districts) {
        const cityLevel = city.level === 'city' ? 'city' : 'district';
        
        await pool.execute(
          'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
          [city.adcode, city.name, cityLevel, district.adcode]
        );
        
        if (city.districts && city.districts.length > 0) {
          for (const d of city.districts) {
            if (d.level === 'country') continue;
            // For direct-controlled cities, street-level items are towns
            if (d.level === 'street') {
              await pool.execute(
                'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
                [d.adcode, d.name, 'town', city.adcode]
              );
              continue;
            }
            const dLevel = 'district';
            
            await pool.execute(
              'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
              [d.adcode, d.name, dLevel, city.adcode]
            );
            
            // Fetch towns for this district if not already included
            if (d.districts && d.districts.length > 0) {
              for (const town of d.districts) {
                if (town.level !== 'country') {
                  await pool.execute(
                    'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
                    [town.adcode, town.name, 'town', d.adcode]
                  );
                }
              }
            }
          }
        }
      }
    }
  }
  
  return districts;
}

// Full sync - recursively fetch all provinces, cities, districts, towns
async function fullSyncAllDistricts() {
  console.log('Starting full district sync...');
  
  // First, get all provinces with subdistrict=3 to get cities + districts + towns
  const provinceUrl = `https://restapi.amap.com/v3/config/district?key=${AMap_KEY}&keywords=100000&subdistrict=3&extensions=base`;
  const provinceResp = await fetch(provinceUrl);
  const provinceData = await provinceResp.json();
  
  if (provinceData.status !== '1') {
    throw new Error(provinceData.info || 'API返回错误');
  }
  
  const provinces = provinceData.districts?.[0]?.districts || [];
  console.log(`Found ${provinces.length} provinces`);
  
  let totalSynced = 0;
  
  for (const province of provinces) {
    console.log(`Syncing province: ${province.name} (${province.adcode})`);
    
    // Insert province
    await pool.execute(
      'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
      [province.adcode, province.name, 'province', null]
    );
    totalSynced++;
    
    // Cities come pre-loaded when using subdistrict=2
    const cities = province.districts || [];
    
    for (const city of cities) {
      await pool.execute(
        'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
        [city.adcode, city.name, 'city', province.adcode]
      );
      totalSynced++;
      
      // Districts come pre-loaded when using subdistrict=2
      const districts = city.districts || [];
      
      for (const district of districts) {
        // For direct-controlled cities (like 中山市), street-level items are actually towns
        if (district.level === 'street') {
          await pool.execute(
            'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
            [district.adcode, district.name, 'town', city.adcode]
          );
          totalSynced++;
          continue;
        }
        await pool.execute(
          'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
          [district.adcode, district.name, 'district', city.adcode]
        );
        totalSynced++;
        
        // Fetch towns for this district
        try {
          const townUrl = `https://restapi.amap.com/v3/config/district?key=${AMap_KEY}&keywords=${district.adcode}&subdistrict=1&extensions=base`;
          const townResp = await fetch(townUrl);
          const townData = await townResp.json();
          
          const towns = townData.districts?.[0]?.districts || [];
          
          for (const town of towns) {
            await pool.execute(
              'INSERT INTO districts (adcode, name, level, parent_adcode) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), parent_adcode = VALUES(parent_adcode), updated_at = CURRENT_TIMESTAMP',
              [town.adcode, town.name, 'town', district.adcode]
            );
            totalSynced++;
          }
        } catch (e) {
          console.log(`  Failed to sync towns for ${district.name}: ${e.message}`);
        }
      }
    }
  }
  
  console.log(`Full sync complete. Total records: ${totalSynced}`);
  return totalSynced;
}

router.get('/', async (req, res) => {
  const adcode = req.query.adcode || '100000';
  
  try {
    // Always fetch directly from Amap API
    const url = `https://restapi.amap.com/v3/config/district?key=${AMap_KEY}&keywords=${adcode}&subdistrict=1&extensions=base`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === '1' && data.districts?.[0]) {
      const children = data.districts[0].districts || [];
      const districts = children
        .filter(d => d.level !== 'country')
        .map(d => ({
          adcode: d.adcode,
          name: d.name,
          level: d.level
        }));
      return res.json({ status: '1', districts, source: 'amap' });
    }
    
    res.json({ status: '1', districts: [], source: 'amap' });
  } catch (error) {
    console.error('获取地区数据失败:', error);
    res.status(500).json({
      status: '0',
      message: '获取地区数据失败，请稍后重试'
    });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const totalSynced = await fullSyncAllDistricts();
    res.json({
      status: '1',
      message: `地区数据同步成功，共 ${totalSynced} 条记录`
    });
  } catch (error) {
    console.error('同步地区数据失败:', error);
    res.status(500).json({
      status: '0',
      message: '同步地区数据失败'
    });
  }
});

module.exports = router;
module.exports.syncDistrictsFromAmap = syncDistrictsFromAmap;
module.exports.fullSyncAllDistricts = fullSyncAllDistricts;
