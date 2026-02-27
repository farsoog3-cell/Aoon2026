import express from "express";
import http from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import fs from "fs";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let k6Process = null;

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("startTest", ({ url, vus, duration }) => {
    if (k6Process) return;

    const script = `
      import http from 'k6/http';
      import { sleep } from 'k6';

      export const options = {
        vus: ${vus},
        duration: '${duration}s',
      };

      export default function () {
        let res = http.get('${url}');
        sleep(1);
      }
    `;

    fs.writeFileSync("test.js", script);

    k6Process = spawn("k6", ["run", "--summary-export=summary.json", "test.js"]);

    k6Process.stdout.on("data", (data) => {
      const text = data.toString();
      socket.emit("log", text);
    });

    k6Process.on("close", () => {
      if (fs.existsSync("summary.json")) {
        const summary = JSON.parse(fs.readFileSync("summary.json"));
        socket.emit("summary", summary);
      }
      k6Process = null;
    });
  });

  socket.on("stopTest", () => {
    if (k6Process) {
      k6Process.kill("SIGINT");
      k6Process = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
