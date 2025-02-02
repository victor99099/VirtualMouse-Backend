const WebSocket = require('ws');
const QRCode = require('qrcode');
const robot = require('robotjs');
const express = require('express');
const http = require('http');
const { mouse } = require('@nut-tree-fork/nut-js');
const { spawn } = require('child_process');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });



// Serve the web app
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Virtual Mouse</title>
      </head>
      <body>
        <h1>Scan the QR Code to Connect</h1>
        <canvas id="qrCanvas"></canvas>
        <script>
          const wsUrl = 'ws://' + "192.168.18.8:8080";
          fetch('/generate-qr?url=' + wsUrl)
            .then(response => response.text())
            .then(data => {
              const canvas = document.getElementById('qrCanvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();
              img.src = data;
              img.onload = () => ctx.drawImage(img, 0, 0);
            });
        </script>
      </body>
    </html>
  `);
});
const screenSize = robot.getScreenSize();
const screenWidth = screenSize.width;
const screenHeight = screenSize.height;
// Generate QR code
app.get('/generate-qr', async (req, res) => {
  const qrCode = await QRCode.toDataURL(req.query.url);
  res.send(qrCode);
});

let drawingProcess;
let isDrawing = false;
let color = 'Red';



function startDrawing(color = 'Red') {
  drawingProcess = spawn('C:\\Program Files\\dotnet\\dotnet.exe', [
    'D:\\Flutter\\project\\virtualmousebackend\\MouseDrawerApp\\bin\\Debug\\net8.0-windows\\MouseDrawerApp.dll',
    'Red'
  ]);

  drawingProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  drawingProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  drawingProcess.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });

  return drawingProcess;  // Return the process to control it later
}

function pauseDrawing(drawingProcess) {
  if (drawingProcess) {
    drawingProcess.stdin.write('pausedrawing\n');  // Send stop drawing command
    console.log("Drawing process paused");
  }
}

function resumeDrawing(drawingProcess) {
  if (drawingProcess) {
    drawingProcess.stdin.write('resumedrawing\n');  // Send start drawing command
    console.log("Drawing process resumed");
  }
}

function stopDrawing(drawingProcess) {
  if (drawingProcess) {
    drawingProcess.kill();
    console.log("Drawing process stopped");
  }
}

function undoDrawing(drawingProcess) {
  if (drawingProcess) {
    drawingProcess.stdin.write('undo\n');
    console.log("Undo drawing");
  }
}

function redoDrawing(drawingProcess) {
  if (drawingProcess) {
    drawingProcess.stdin.write('redo\n');
    console.log("Redo drawing");
  }
}
// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Mobile app connected.');
  ws.send('Hello from server!');
  ws.on('message', (message) => {
    // Ensure the message is a string
    let msgString = '';

    if (Buffer.isBuffer(message)) {
      msgString = message.toString(); // Convert Buffer to string
    } else if (typeof message === 'string') {
      msgString = message; // It's already a string
    }

    // Now safely split the message
    const [command, ...params] = msgString.split(',');

    if (command === 'move') {
      // Move the cursor relatively
      const dx = parseFloat(params[0]);
      const dy = parseFloat(params[1]);
      const currentPos = robot.getMousePos();
      console.log(currentPos, dx, dy)
      robot.moveMouse(currentPos.x + dx, currentPos.y + dy);
    }
    else if (command === 'pointer2') {
      const px = parseFloat(params[0]);
      const py = parseFloat(params[1]);
      const movement = checkScreenBoundaries(px, py);
      console.log(movement)
      // For example, adjust the cursor position based on accelerometer data
      const currentPos = robot.getMousePos();
      robot.moveMouse(currentPos.x + movement.x, currentPos.y + movement.y);
    }
    else if (command === 'pointer') {
      const px = parseFloat(params[0]);
      const py = parseFloat(params[1]);
      const movement = checkScreenBoundaries(px, py);
      console.log(movement)
      // For example, adjust the cursor position based on accelerometer data
      const currentPos = robot.getMousePos();
      robot.moveMouse(currentPos.x + movement.x, currentPos.y + movement.y);
    }
    else if (command === 'Center') {
      console.log(screenWidth, screenHeight)
      robot.moveMouse(screenWidth / 2, screenHeight / 2);
    }
    else if (command === 'scrollUp') {
      // Scroll up
      const dx = parseFloat(params[0]);
      const dy = parseFloat(params[1]);
      console.log(`Scrolling up with dx: ${dx}, dy: ${dy}`);
      mouse.scrollUp(dx + 50, dy + 50);
    }
    else if (command === 'scrollDown') {
      // Scroll down
      const dx = parseFloat(params[0]);
      const dy = parseFloat(params[1]);
      // console.log(`Scrolling down with dx: ${dx}, dy: ${dy}`);
      mouse.scrollDown(dx + 50, dy + 50);
    }
    else if (command === 'click') {
      // Handle mouse click (1 for left-click, 2 for right-click)
      const button = parseInt(params[0]);
      if (button === 1) {
        robot.mouseClick(); // Left click
      } else if (button === 2) {
        robot.mouseClick('right'); // Right click
      }
    } else if (command === 'modifier') {
      const modifier = params[0];
      console.log(`Hold ${modifier} key`);
      robot.keyToggle(modifier, 'down');
    } else if (command === 'release') {
      const modifier = params[0];
      console.log(`release ${modifier} key`);
      robot.keyToggle(modifier, 'up');
    }
    else if (command === 'key') {
      console.log("tapped");
      console.log(`tapped comma  ${params[0]}`);
      if (params[0] == 'comma') {
        robot.keyTap(',');
      }
      else {
        console.log(`Pressing key: ${params[0]}`);
        robot.keyTap(params[0]);
      }

    }
    else if (command == 'Double') {
      robot.mouseClick();

      // Wait a short delay (e.g., 100 milliseconds) and perform the second click
      setTimeout(() => {
        robot.mouseClick();
      }, 100);
    }
    else if (command === 'mouseHoldStart') {
      console.log(command);
      if (isDrawing) {

        console.log("resume Drawing");
        resumeDrawing(drawingProcess);
      }
      else {
        robot.mouseToggle('down', 'left');
      }

    }
    else if (command === 'mouseHoldEnd') {
      console.log(command);
      if (isDrawing) {
        pauseDrawing(drawingProcess);
        console.log("Paused Drawing");
      }
      else {
        robot.mouseToggle('up', 'left');
      }
    }
    else if (command === 'startDrawing') {
      drawingProcess = startDrawing(color);
      console.log("started Drawing")
      isDrawing = true;

    } else if (command === 'stopDrawing') {
      console.log("Stopped Drawing");
      isDrawing = false;
      stopDrawing(drawingProcess);
    }
    else if (command === 'undo') {
      if(drawingProcess != null){
        undoDrawing(drawingProcess);
      }

    } else if (command === 'redo') {
      if(drawingProcess != null){
        redoDrawing(drawingProcess);
      }

    }
    else if (command === 'changeColor') {
      color = params[0];
    }
  });


  ws.on('close', () => {
    console.log('Mobile app disconnected.');
  });
});

// Start server
server.listen(8080, () => {
  console.log('Web app running at http://localhost:8080');
});


function checkScreenBoundaries(x, y) {
  const currentPos = robot.getMousePos();

  const newX = Math.max(0, Math.min(screenSize.width, currentPos.x + x * 16));
  const newY = Math.max(0, Math.min(screenSize.height, currentPos.y + y * 9));

  return { x: newX - currentPos.x, y: newY - currentPos.y };
}