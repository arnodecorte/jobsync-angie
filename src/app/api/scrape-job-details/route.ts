import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Check if running on Vercel to determine the python command
    const isVercel = process.env.VERCEL === "1";
    // Vercel uses 'python', Windows uses 'python', Mac/Linux often use 'python3'
    const pythonExecutable = isVercel ? "python" : (process.platform === 'win32' ? 'python' : 'python3');

    // Construct the absolute path to the scraper script
    const scraperScriptPath = path.join(
      process.cwd(),
      "tools",
      "scraper",
      "scraper.py"
    );

    // Spawn a new child process to run the Python script
    const scraper = spawn(pythonExecutable, [scraperScriptPath, url]);

    let dataToSend = "";
    let errorData = "";

    // Listen for data from the script's standard output
    for await (const chunk of scraper.stdout) {
      dataToSend += chunk;
    }

    // Listen for data from the script's standard error
    for await (const chunk of scraper.stderr) {
      errorData += chunk;
    }

    // Wait for the script to exit and get the exit code
    const exitCode = await new Promise((resolve) => {
      scraper.on("close", resolve);
    });

    // If the script exited with an error code, throw an error
    if (exitCode !== 0) {
      console.error(`Scraper stderr: ${errorData}`);
      throw new Error(`Scraper script failed with exit code ${exitCode}: ${errorData}`);
    }

    // Parse the JSON data from the script and send it as a response
    return NextResponse.json(JSON.parse(dataToSend));
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    // Return a generic server error response
    return NextResponse.json({ error: message }, { status: 500 });
  }
}