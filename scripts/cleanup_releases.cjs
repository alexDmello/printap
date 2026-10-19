// Cleans up broken or duplicate releases in GitHub Releases to prevent 404s on latest.yml
async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.log("[cleanup_releases] No GITHUB_TOKEN provided, skipping cleanup.");
    return;
  }

  const repo = "alexDmello/printap";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Printap-CI",
  };

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
    if (!res.ok) {
      console.warn("[cleanup_releases] Failed to fetch releases:", res.status, res.statusText);
      return;
    }

    const releases = await res.json();
    console.log(`[cleanup_releases] Fetched ${releases.length} releases.`);

    // Find duplicate or broken releases where assets are missing or multiple releases exist for the same tag
    const tagCount = {};
    for (const r of releases) {
      tagCount[r.tag_name] = (tagCount[r.tag_name] || 0) + 1;
    }

    for (const r of releases) {
      // If tag is v0.3.15 (known broken duplicate) or has no latest.yml and duplicate exists
      const isDuplicate = tagCount[r.tag_name] > 1;
      const isKnownBroken = r.tag_name === "v0.3.15";
      const hasLatestYml = r.assets?.some((a) => a.name === "latest.yml");

      if (isKnownBroken || (isDuplicate && !hasLatestYml)) {
        console.log(`[cleanup_releases] Deleting release id=${r.id} tag=${r.tag_name} (hasLatestYml=${hasLatestYml})`);
        const delRes = await fetch(`https://api.github.com/repos/${repo}/releases/${r.id}`, {
          method: "DELETE",
          headers,
        });
        console.log(`[cleanup_releases] Delete result for ${r.id}: status=${delRes.status}`);
      }
    }
  } catch (err) {
    console.warn("[cleanup_releases] Warning:", err);
  }
}

main();
