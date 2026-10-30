const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const path = require("path");
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// In-memory store (seeded with richer Wave data for testing/demo)
const waves = {
  1: {
    region: 1,
    status: 'ready',
    details: {
      name: 'Wave 1',
      artifacts: [
        'Wave1_Results.yaml',
        'Wave1_TestReport.json',
        'Wave1_CodeCoverage.csv',
        'Wave1_Evidence_Log.txt'
      ]
    },
    evidence: [
      { type: 'log', path: 'Wave1_Evidence_Log.txt', ok: true }
    ]
  },
  2: {
    region: 1,
    status: 'pending',
    details: { name: 'Wave 2', artifacts: ['Wave2_Results.yaml', 'Wave2_TestReport.json', 'Wave2_CodeCoverage.csv', 'Wave2_Evidence_Log.txt'] }
  },
  3: {
    region: 1,
    status: 'pending',
    details: { name: 'Wave 3', artifacts: ['Wave3_Results.yaml', 'Wave3_TestReport.json', 'Wave3_CodeCoverage.csv', 'Wave3_Evidence_Log.txt'] }
  }
};

let runCounter = 1;

app.get('/api/waves', (req, res) => {
  res.json({ waves });
});

// Get a single wave detail (enhanced for testing)
app.get('/api/wave/:id', (req, res) => {
  const id = req.params.id;
  const w = waves[id];
  if (!w) return res.status(404).json({ error: 'wave not found' });
  res.json({ wave: id, ...w });
});

// Additional wave details (more granular)
app.get('/api/wave/:id/details', (req, res) => {
  const id = req.params.id;
  const w = waves[id];
  if (!w) return res.status(404).json({ error: 'wave not found' });
  res.json({ wave: id, details: w.details });
});

// Evidence for a wave (simple mock)
app.get('/api/wave/:id/evidence', (req, res) => {
  const id = req.params.id;
  const w = waves[id];
  if (!w) return res.status(404).json({ error: 'wave not found' });
  res.json({ wave: id, evidence: w.evidence || [] });
});

// Evidence map endpoint (mock mapping aligned to Artifact_Spec.yaml)
app.get('/api/evidence-map', (req, res) => {
  const map = {
    "Runbook 3.1": "Runbooks/Runbook_3.1.md",
    "Runbook 3.2": "Runbooks/Runbook_3.2.md",
    "Runbook 3.3": "Runbooks/Runbook_3.3.md",
    "Runbook 3.4": "Runbooks/Runbook_3.4.md",
    "Runbook 3.5": "Runbooks/Runbook_3.5.md",
    "StartWork_Entrypoint.md": "StartWork_Entrypoint.md",
    "Vault_Runtime_Injection_Plan.md": "Vault_Runtime_Injection_Plan.md",
    "Evidence_Metadata_Schema.md": "Evidence_Metadata_Schema.md",
    "Wave1_Results.yaml": "Wave1_Results.yaml",
    "Wave1_TestReport.json": "Wave1_TestReport.json",
    "Wave1_CodeCoverage.csv": "Wave1_CodeCoverage.csv",
    "Wave1_Evidence_Log.txt": "Wave1_Evidence_Log.txt",
    "Wave3_Evidence_Log.txt": "Wave3_Evidence_Log.txt",
    "Final_Verification_Report.md": "Final_Verification_Report.md",
    "Verification_Ledger.xlsx": "Verification_Ledger.xlsx"
  };
  res.json(map);
});

app.post('/api/start', (req, res) => {
  const { wave, region } = req.body;
  if (!wave) return res.status(400).json({ error: 'wave is required' });
  const id = `run_${runCounter++}`;
  // mark as started in a very simple way
  waves[wave] = waves[wave] || {}; 
  waves[wave].status = 'started';
  waves[wave].region = region || waves[wave].region;
  res.json({ ok: true, runId: id, wave, status: waves[wave].status });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend assets (simple integration test UI)
app.use('/frontend', express.static(path.join(__dirname, "../frontend")));

// Simple artifact endpoint (placeholder)
app.get('/api/artifacts/:name', (req, res) => {
  const name = req.params.name;
  res.json({ name, exists: true, path: `/artifacts/${name}` });
});

// Test harness: run a quick test if this file is invoked directly
if (require.main === module) {
// Start on preferred port, fallback to next port if in use
  const tryPort = (p) => {
    const s = app.listen(p, () => {
      console.log(`Backend listening at http://localhost:${p}`);
    });
    s.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const next = p + 1;
        tryPort(next);
      } else {
        console.error('Server startup error:', err);
      }
    });
  };
  tryPort(port);
}

module.exports = app;
