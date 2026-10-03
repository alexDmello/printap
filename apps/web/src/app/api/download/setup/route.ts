import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Default GitHub Releases free direct download links (hosted on public GitHub Releases, 0 database cost)
const DEFAULT_GITHUB_SETUP_URL =
  "https://github.com/alexDmello/printap/releases/latest/download/Printap-Setup.exe";
const DEFAULT_GITHUB_PORTABLE_URL =
  "https://github.com/alexDmello/printap/releases/latest/download/Printap-Portable.exe";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isPortable = searchParams.get("type") === "portable";

  // 1. In production, check for configured direct CDN / drive URL
  const configuredUrl = isPortable
    ? process.env.NEXT_PUBLIC_DESKTOP_PORTABLE_URL || process.env.DESKTOP_PORTABLE_URL
    : process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL || process.env.DESKTOP_DOWNLOAD_URL;

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
  const targetUrl = isPortable ? DEFAULT_GITHUB_PORTABLE_URL : DEFAULT_GITHUB_SETUP_URL;
  return NextResponse.redirect(targetUrl, 302);
}
