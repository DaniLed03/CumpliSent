const { spawn } = require('node:child_process');

const env = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => typeof value === 'string')
);

delete env.ELECTRON_RUN_AS_NODE;
env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --no-warnings`.trim();

const electron =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm exec electron .'], {
        stdio: 'inherit',
        env,
      })
    : spawn('npm', ['exec', 'electron', '.'], {
        stdio: 'inherit',
        env,
      });

electron.on('exit', (code) => {
  process.exit(code ?? 0);
});
