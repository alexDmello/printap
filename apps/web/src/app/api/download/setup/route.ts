import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Default GitHub Releases free direct download link
const DEFAULT_GITHUB_RELEASE_URL =
  "https://github.com/alexDmello/printap/releases/latest/download/Printap-Setup.exe";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isPortable = searchParams.get("type") === "portable";

  // 1. In production, redirect to free GitHub Releases or custom CDN
  const configuredUrl = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL;
  if (configuredUrl) {
    return NextResponse.redirect(configuredUrl, 302);
  }

  // 2. Check for local desktop dist binary (for seamless local development & offline testing)
  try {
    const desktopDistDir = path.resolve(process.cwd(), "..", "desktop", "dist");
    const targetFile = isPortable
      ? "Printap-Portable-0.0.1.exe"
      : "Printap Setup 0.0.1.exe";
    const filePath = path.join(desktopDistDir, targetFile);

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);

      // Convert Node readable stream to Web ReadableStream
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream, {
        headers: {
          "Content-Disposition": `attachment; filename="${
            isPortable ? "Printap-Portable.exe" : "Printap-Setup.exe"
          }"`,
          "Content-Type": "application/vnd.microsoft.portable-executable",
          "Content-Length": stats.size.toString(),
        },
      });
    }
  } catch (err) {
    console.warn("[DownloadAPI] Local file check error:", err);
  }

  // 3. Fallback: Redirect to GitHub Releases asset
  return NextResponse.redirect(DEFAULT_GITHUB_RELEASE_URL, 302);
}
