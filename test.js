var os = require('os');
// var pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

// var shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh';

// var ptyProcess = pty.spawn(shell, [], {
//   name: 'xterm-color',
//   cols: 80,
//   rows: 30,
//   cwd: process.env.HOME,
//   env: process.env
// });

// ptyProcess.onData((data) => {
// //  process.stdout.write(data);
// });

// ptyProcess.write('ls\r');
// ptyProcess.resize(100, 40);
// ptyProcess.write('ls\r');
console.log(process.stdin.isTTY);
fs.open(path.join(__dirname, 'test.txt'), 'w', (err, fd) => {
    if (err) {
        console.error(err);
        return;
    }
    // const child = childProcess.spawn('/bin/zsh', 
    const child = childProcess.spawn('script', ['-q', 'test.txt', '/bin/zsh'],
        {    
            stdio: ['pipe','inherit','inherit'],
            env: {
                ...process.env,
                TERM: 'xterm-256color',
            }
        }
    );
    child.stdin.write('ls\n');
    child.stdin.write('exit\n');
    child.on('close', (code) => {
        fs.close(fd, () => {})
    });
})