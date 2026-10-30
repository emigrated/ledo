# 桌面客户端打包与发布（更新目录）

> 适用：企业微信/内部使用的 Electron 桌面客户端「企业内部系统」
> **2026-10-30 打包 1.0.17 时，按实际跑通的步骤重写了一遍。以前没有留下任何打包记录，这篇是第一次完整的。**

## 一、这套东西是怎么跑的

```
员工电脑上的「企业内部系统」客户端
        │  启动后自己拉清单
        ▼
https://emigrated.i234.me:3443/api/updates/latest-mac.yml   （Mac）
https://emigrated.i234.me:3443/api/updates/latest.yml       （Windows）
        │  清单里的版本号 > 自己的版本号 → 提示更新 → 下载
        ▼
群晖反向代理 → 后端容器 ledo-backend
        │  backend/src/routes/updates.js
        ▼
磁盘目录 /volume1/docker/ledo/backend/uploads/updates
```

几个必须记牢的事实：

1. **客户端是内嵌前端的**（`frontend/electron/main.cjs` 里 `mainWindow.loadFile('../dist/index.html')`）。
   改了网页代码后，**网页浏览器会立刻生效，桌面客户端不会**，必须重新打包发布。
2. **更新地址写死在 `main.cjs`** 里的 `UPDATE_BASE_URL`（3443 端口）。改端口要同时改这里和
   `frontend/package.json` 的 `build.publish.url`。3443 和 5443 目前都通。
3. **客户端没用 electron-updater**，是自己写的一整套：`fetch` 拉 yml → 用 semver 比大小 →
   自己流式下载 exe/zip → Mac 用 `ditto` 解压。
   **所以 `.blockmap` 不是必需的**（那是差分下载才用），缺了顶多是全量下载。历史版本有，保持一致就传。
4. **只看版本号，不看文件日期。** 版本号必须比更新目录里现有的大，装了同版本号的人不会收到任何提示。

## 二、打包环境（关键，踩过坑）

| 目标 | 可用的构建环境 | 说明 |
|---|---|---|
| **Mac**（x64 / arm64 zip） | macOS 电脑 | Windows/Linux 出不了 mac 包 |
| **Windows**（nsis exe） | Debian 系容器，**或** macOS 电脑 | 见下 |

⚠️ **不要用 NAS 上那个 `ledo-frontend` 容器打包。** 三个原因：
- 它是 Alpine（musl），而 electron-builder 下载的 `makensis`、`7za` 是 glibc 程序，
  跑起来报 `__wprintf_chk: symbol not found`（装 gcompat 也不够）；
- 它的 `/app` 只有 `src`、`index.html`、`vite.config.js` 是挂载进去的，
  **`package.json` 是镜像里那份老文件**（版本还停在 1.0.2、productName 是 Ledo Registration），
  打出来的包名字和版本都是错的；
- 在里面装系统包会把正在跑的开发服务器搞脏。

### Windows 包怎么打（2026-10-30 走通的方案）

用一个临时的 Debian 容器，源码单独复制一份，不动线上任何东西：

```bash
# 1 在 NAS 上复制一份源码（排除 node_modules/dist/release）
ssh nas 'mkdir -p /volume1/docker/ledo-build/frontend'
ssh nas 'cd /volume1/docker/ledo/frontend && tar cf - \
  --exclude=node_modules --exclude=dist --exclude=release \
  --exclude=@eaDir --exclude=.DS_Store --exclude="._*" . \
  | tar xf - -C /volume1/docker/ledo-build/frontend'

# 2 用 Debian 系 node 镜像构建
ssh nas 'sudo -n /usr/local/bin/docker run --rm --name ledo-winbuild \
  -v /volume1/docker/ledo-build/frontend:/app -w /app \
  -e ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ -e HOME=/root \
  node:22-bookworm-slim bash -c "\
    npm config set registry https://registry.npmmirror.com && \
    npm install --no-audit --no-fund && \
    npm run build && \
    ./node_modules/.bin/electron-builder --win --x64"'
```

（`apt-get update` 在容器里连不上官方源，所以别想着装 wine。）

### 免 wine 补丁

electron-builder 26.x 在 Linux 上打 NSIS 时，会用 **`wine` 执行一遍刚生成的安装包**来抠出卸载程序；
但在 macOS 上走的是另一条路——直接读 PE 文件（`UninstallerReader`），不需要 wine。
容器里没有 wine 就会报 `wine process failed ENOENT`。改一行即可，改的是**临时构建目录里**的
`node_modules`，不动源码：

```
node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js
把
    const wineVm = new WineVm_1.WineVmManager(...);
    await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
换成
    await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
```

改完重跑一次 `electron-builder --win --x64` 即可。

这个改动已经脚本化：**`scripts/patch-nsis-no-wine.sh`**（在仓库里）。用法：

```bash
docker run --rm -v <构建目录>:/app -v /path/to/scripts/patch-nsis-no-wine.sh:/patch.sh \
  node:22-bookworm-slim bash /patch.sh
```

（脚本里用的是 `node`，不是 python —— Debian 版 node 镜像没装 python。）
（另注：在 macOS 上直接跑 `--win` 理论上连补丁都不用，因为走的是 UninstallerReader 分支 —— 尚未实测。）

## 三、打包步骤

### 第 0 步：确认版本号

```bash
ssh nas 'head -1 /volume1/docker/ledo/backend/uploads/updates/latest.yml'   # version:
ssh nas 'head -1 /volume1/docker/ledo/backend/uploads/updates/latest-mac.yml'
```

新版本号必须**大于**现有值。

### 第 1 步：改版本号

`frontend/package.json` 的 `"version"` 决定产物文件名和清单里的版本号。**Mac 和 Windows 两边都必须是同一个值**，
也就是说本机那份和 NAS 容器那份都要改。

```bash
ssh nas 'cd /volume1/docker/ledo/frontend && cp package.json package.json.bak.$(date +%Y%m%d%H%M%S)'
ssh nas 'cd /volume1/docker/ledo/frontend && sed -i "s/\"version\": \"1.0.16\"/\"version\": \"1.0.17\"/" package.json'
```

改完记得 `git add frontend/package.json` 提交（post-commit 钩子会自动推 GitHub）。

### 第 2 步：本机（macOS）打 Mac 包

源码不在本机时先同步：

```bash
ssh nas 'cd /volume1/docker/ledo/frontend && tar cf - \
  --exclude=node_modules --exclude=dist --exclude=release \
  --exclude=@eaDir --exclude=.DS_Store --exclude="._*" .' | tar xf - -C <本地目录>
```

```bash
cd <本地目录>
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install --no-audit --no-fund
npm run build                                   # vite build → dist/
env -u NODE_OPTIONS npx electron-builder --mac -c.directories.output=$HOME/Downloads/ledo-release
```

两个注意点：
- **`env -u NODE_OPTIONS` 不能少**：环境里注入的 `NODE_OPTIONS` 会挂一层文件代理，
  electron 解压（几万个小文件）时会被它拖死，报 `max virtual memory / uv_rwlock` 之类的错。
- **输出到 `~/Downloads`**：工作目录的反病毒/备份机制会拦掉 electron 的临时锁文件操作。

如果 electron-builder 最后一步没能自己压 zip，用系统自带的 `ditto` 补（`zip` 命令可能被策略拦）：

```bash
cd ~/Downloads/ledo-release
ditto -c -k --keepParent --sequesterRsrc "mac/企业内部系统.app"      "企业内部系统-<版本>-mac.zip"
ditto -c -k --keepParent --sequesterRsrc "mac-arm64/企业内部系统.app" "企业内部系统-<版本>-arm64-mac.zip"
```

Mac 包没有签名，别人第一次打开会被系统拦一下，**右键 → 打开** 即可，跟以前一样。

### 第 3 步：打 Windows 包

按「二」里的 Debian 容器方案。产出在 `/volume1/docker/ledo-build/frontend/release/`：

```
企业内部系统 Setup <版本>.exe
企业内部系统 Setup <版本>.exe.blockmap
latest.yml          ← 这一步会自己生成，别手算 sha512
```

### 第 4 步：核对两边产出一致

Mac 的 zip 和 Windows 的 win-unpacked 里应该有**同一个哈希名**的前端产物：

```bash
ls <mac>.app/Contents/Resources/app/dist/assets/     # 例如 index.BEqkJcao.js
ls win-unpacked/resources/app/dist/assets/           # 必须同名，说明打包用的是同一版代码
```

再用一个新功能的关键词验一下内容确实进去了：

```bash
grep -c "新功能的中文文案" .../dist/assets/index.*.js
```

### 第 5 步：放进更新目录

更新目录 = `/volume1/docker/ledo/backend/uploads/updates`。
文件名带空格，命令里务必加引号。

顺序：**先备份旧 manifest → 传安装包 → 最后替换 manifest**。
`latest*.yml` 就是分发开关，必须等安装包全部传完再顶上去，
否则客户端可能读到新版本号、却下载到还没传完的包。

```bash
ssh nas 'cd /volume1/docker/ledo/backend/uploads/updates && \
  cp latest.yml latest.yml.bak.$(date +%Y%m%d) && \
  cp latest-mac.yml latest-mac.yml.bak.$(date +%Y%m%d)'
```

需要放进去的文件：

```
企业内部系统 Setup <版本>.exe            （+ 可选 .exe.blockmap）
企业内部系统-<版本>-mac.zip              （+ 可选 .zip.blockmap）
企业内部系统-<版本>-arm64-mac.zip        （+ 可选 .zip.blockmap）
latest.yml        version / path / sha512 / size，Windows 用
latest-mac.yml    version / path / files[] / sha512 / size，Mac 用
```

`latest-mac.yml` 的 `files` 数组要有两个（第一个是 Intel x64，第二个是 arm64），
客户端靠 **url 里有没有 `arm64`** 挑。手写的格式参考仓库里已提交的版本。

### 第 6 步：验证

```bash
# 清单正确
curl -k https://emigrated.i234.me:3443/api/updates/latest.yml
curl -k https://emigrated.i234.me:3443/api/updates/latest-mac.yml

# 安装包能下载（Content-Length 要对得上清单里的 size）
curl -kI "https://emigrated.i234.me:3443/api/updates/企业内部系统 Setup 1.0.17.exe"
curl -kI "https://emigrated.i234.me:3443/api/updates/企业内部系统-1.0.17-mac.zip"
```

sha512 校（`base64` 格式，要和清单逐字相同）：

```bash
openssl dgst -sha512 -binary "<文件>" | openssl base64 -A
```

最后找一台装了旧版本的电脑打开客户端，应该弹更新提示 → 点更新 → 装完版本号变成新的。

## 四、回滚

客户端只看 `latest*.yml`，把 manifest 换回上一版就立刻停止分发新包：

```bash
cd /volume1/docker/ledo/backend/uploads/updates
cp latest.yml.bak.<时间戳>     latest.yml
cp latest-mac.yml.bak.<时间戳> latest-mac.yml
```

前提是先备份过。**每次更新前务必先备份这两个文件。**

## 五、历史版本记录

| 版本 | 打包日期 | 说明 |
|---|---|---|
| 1.0.15 | 2026-09-13 | 早期版本，包体仍在更新目录里 |
| 1.0.16 | 2026-09-22 | 上一版线上版本 |
| 1.0.17 | 2026-10-30 | 含：订单录入/维修登记/退货登记草稿恢复、退货批量结算凭证、管理员修改免审核、维修修改记录展示、修改记录隐藏 adcode 并按地址层级排序 |

## 六、几个容易误会的点

- `scripts/build_patch.py` 是空壳占位文件，跟这套打包**没有关系**。
- 更新目录里 1.0.15 的旧包目前还留着（含 blockmap，大约 320MB），
  删不删看心情，**不影响**任何东西——客户端只认 `latest*.yml`。
- 打包用的临时目录 `/volume1/docker/ledo-build` 用完可以整个删掉。
