export default async function handler(req, res) {
  try {
    const username = (req.query.user || "draj48").toString();

    const token = process.env.GITHUB_TOKEN; // optional but recommended
    const headers = {
      "User-Agent": "github-stats-card",
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // ---- Fetch user info ----
    const userRes = await fetch(`https://api.github.com/users/${username}`, { headers });
    const user = await userRes.json();

    if (!user || user.message) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.status(200).send(errorSVG(`User not found: ${username}`));
      return;
    }

    // ---- Fetch repos for stars ----
    const reposRes = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100`,
      { headers }
    );
    const repos = await reposRes.json();

    const totalStars = Array.isArray(repos)
      ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
      : 0;

    // ---- Search counts (PRs, Issues, Merged PRs) ----
    const search = async (q) => {
      const r = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
        { headers }
      );
      const data = await r.json();
      return data?.total_count || 0;
    };

    const totalPRs = await search(`type:pr author:${username}`);
    const totalIssues = await search(`type:issue author:${username}`);
    const mergedPRs = await search(`type:pr author:${username} is:merged`);

    const followers = user.followers ?? 0;
    const following = user.following ?? 0;
    const publicRepos = user.public_repos ?? 0;

    // ---- Grade logic (same idea as before) ----
    let grade = "C";
    const score = totalStars + totalPRs * 2 + mergedPRs * 3;
    if (score > 5000) grade = "S";
    else if (score > 2000) grade = "A";
    else if (score > 800) grade = "B";

    const name = escapeXML((user.name || username).slice(0, 18));
    const login = escapeXML(username);

    // ---- SVG Card ----
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="280" viewBox="0 0 920 280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050705"/>
      <stop offset="100%" stop-color="#030503"/>
    </linearGradient>

    <radialGradient id="glow" cx="20%" cy="15%" r="70%">
      <stop offset="0%" stop-color="rgba(0,255,150,0.22)"/>
      <stop offset="100%" stop-color="rgba(0,255,150,0)"/>
    </radialGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="rgba(0,0,0,0.55)"/>
    </filter>

    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="920" height="280" rx="26" fill="url(#bg)"/>
  <rect x="0" y="0" width="920" height="280" rx="26" fill="url(#glow)"/>

  <!-- Main card border -->
  <rect x="14" y="14" width="892" height="252" rx="22"
        fill="rgba(10,12,10,0.65)"
        stroke="rgba(0,255,150,0.22)"
        stroke-width="2"
        filter="url(#shadow)"/>

  <!-- Avatar -->
  <g transform="translate(42,42)">
    <clipPath id="clip">
      <rect x="0" y="0" width="62" height="62" rx="16"/>
    </clipPath>
    <rect x="-3" y="-3" width="68" height="68" rx="18" fill="rgba(0,255,150,0.10)" stroke="rgba(0,255,150,0.22)"/>
    <image href="${user.avatar_url}" x="0" y="0" width="62" height="62" clip-path="url(#clip)"/>
  </g>

  <!-- Name -->
  <text x="120" y="66" font-size="22" font-weight="900" fill="#E9FFF3" font-family="Segoe UI, Inter, system-ui">${name}</text>
  <text x="120" y="88" font-size="13" font-weight="700" fill="rgba(210,255,232,0.65)" font-family="Segoe UI, Inter, system-ui">@${login}</text>

  <!-- Mini stats boxes -->
  ${miniBox(42, 118, "Followers", followers)}
  ${miniBox(332, 118, "Following", following)}
  ${miniBox(622, 118, "Public Repos", publicRepos)}

  <!-- Stats section -->
  <text x="60" y="205" font-size="15" font-weight="900" fill="#DFFFEF" font-family="Segoe UI, Inter, system-ui">GitHub Stats</text>

  ${rowText(60, 230, "Total Stars Earned", totalStars)}
  ${rowText(60, 255, "Total PRs", totalPRs)}
  ${rowText(360, 230, "Total Issues", totalIssues)}
  ${rowText(360, 255, "Merged PRs", mergedPRs)}

  <!-- Grade ring -->
  <g transform="translate(745,175)">
    <circle cx="80" cy="40" r="54" stroke="rgba(0,255,150,0.14)" stroke-width="12" fill="none"/>
    <circle cx="80" cy="40" r="54" stroke="#00FF96" stroke-width="12" fill="none"
      stroke-linecap="round"
      stroke-dasharray="${calcDash(grade)} 999"
      transform="rotate(-90 80 40)"
      filter="url(#softGlow)"/>

    <text x="80" y="48" text-anchor="middle" font-size="40" font-weight="1000" fill="#E9FFF3" font-family="Segoe UI, Inter, system-ui">${grade}</text>
    <text x="80" y="70" text-anchor="middle" font-size="12" font-weight="900" fill="rgba(210,255,232,0.60)" font-family="Segoe UI, Inter, system-ui">Grade</text>
  </g>

  <!-- Footer -->
  <text x="460" y="268" text-anchor="middle" font-size="12" font-weight="700"
        fill="rgba(210,255,232,0.50)" font-family="Segoe UI, Inter, system-ui">
    Auto-updated • GitHub API • Vercel
  </text>
</svg>`.trim();

    res.setHeader("Content-Type", "image/svg+xml");
    // caching (GitHub README refresh slow hota hai, but ye best practice)
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).send(svg);
  } catch (e) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(errorSVG("Error generating card"));
  }
}

/* --- helpers --- */
function escapeXML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function miniBox(x, y, label, value) {
  return `
  <g>
    <rect x="${x}" y="${y}" width="256" height="74" rx="16"
          fill="rgba(0,0,0,0.35)"
          stroke="rgba(255,255,255,0.06)"/>
    <text x="${x + 18}" y="${y + 28}" font-size="12" font-weight="800"
          fill="rgba(210,255,232,0.60)" font-family="Segoe UI, Inter, system-ui">${label}</text>
    <text x="${x + 18}" y="${y + 56}" font-size="26" font-weight="1000"
          fill="#00FF96" font-family="Segoe UI, Inter, system-ui">${value}</text>
  </g>`;
}

function rowText(x, y, label, value) {
  return `
  <g>
    <text x="${x}" y="${y}" font-size="13" font-weight="800"
          fill="rgba(210,255,232,0.72)" font-family="Segoe UI, Inter, system-ui">${label}</text>
    <text x="${x + 240}" y="${y}" font-size="14" font-weight="1000"
          fill="#E9FFF3" font-family="Segoe UI, Inter, system-ui">${value}</text>
  </g>`;
}

// grade -> ring fill
function calcDash(grade) {
  // circumference approx = 2*pi*r = 2*3.1416*54 = 339
  // choose fill % based on grade
  const total = 339;
  const pct = grade === "S" ? 0.95 : grade === "A" ? 0.80 : grade === "B" ? 0.60 : 0.40;
  return Math.floor(total * pct);
}

function errorSVG(msg) {
  const safe = escapeXML(msg);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="280">
  <rect width="100%" height="100%" rx="26" fill="#050705"/>
  <text x="50%" y="50%" text-anchor="middle" fill="#00ff96"
    font-family="Segoe UI, Inter, system-ui" font-weight="900" font-size="20">${safe}</text>
</svg>`.trim();
}
