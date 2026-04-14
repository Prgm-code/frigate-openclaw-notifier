import { spawn } from "node:child_process";

export function processVideoForWhatsapp(ffmpegBin: string, inputPath: string, outputPath: string, timeoutMs: number): Promise<string> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vcodec",
    "libx264",
    "-profile:v",
    "baseline",
    "-level",
    "3.0",
    "-pix_fmt",
    "yuv420p",
    "-acodec",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, {
      stdio: ["ignore", "ignore", "pipe"],
      shell: false
    });

    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        return;
      }

      resolve(outputPath);
    });
  });
}
