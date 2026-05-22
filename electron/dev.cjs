const { spawn } = require('node:child_process');
const http = require('node:http');

const host = '127.0.0.1';
const port = 5173;
const devServerUrl = `http://${host}:${port}`;
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => typeof value === 'string')
);

delete cleanEnv.ELECTRON_RUN_AS_NODE;
cleanEnv.NODE_OPTIONS = `${cleanEnv.NODE_OPTIONS || ''} --no-warnings`.trim();

function runNpm(args, options = {}) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], options);
  }

  return spawn('npm', args, options);
}

let electron;
let vite;
let ownsVite = false;

function checkVite() {
  return new Promise((resolve) => {
    const request = http.get(devServerUrl, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function startVite() {
  ownsVite = true;
  vite = runNpm(['run', 'dev', '--', '--host', host, '--strictPort'], {
    stdio: 'inherit',
    env: {
      ...cleanEnv,
      BROWSER: 'none',
    },
  });
}

function waitForVite(retriesLeft = 80) {
  return new Promise((resolve, reject) => {
    const request = http.get(devServerUrl, (response) => {
      response.resume();
      resolve();
    });

    request.on('error', () => {
      if (retriesLeft <= 0) {
        reject(new Error(`Vite did not start at ${devServerUrl}`));
        return;
      }

      setTimeout(() => {
        waitForVite(retriesLeft - 1).then(resolve, reject);
      }, 250);
    });
  });
}

function shutdown() {
  if (electron && !electron.killed) {
    electron.kill();
  }

  if (ownsVite && vite && !vite.killed) {
    vite.kill();
  }
}

checkVite()
  .then((isRunning) => {
    if (!isRunning) {
      startVite();
    } else {
      console.log(`Reusing existing Vite dev server at ${devServerUrl}`);
    }

    return waitForVite();
  })
  .then(() => {
    electron = runNpm(['exec', 'electron', '.'], {
      stdio: 'inherit',
      env: {
        ...cleanEnv,
        VITE_DEV_SERVER_URL: devServerUrl,
      },
    });

    electron.on('exit', (code) => {
      shutdown();
      process.exit(code ?? 0);
    });
  })
  .catch((error) => {
    console.error(error);
    shutdown();
    process.exit(1);
  });

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
