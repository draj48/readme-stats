export default async function handler(req, res) {
  try {
    const username = (req.query.user || "draj48").toString();

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.status(200).send(errorSVG("Missing GITHUB_TOKEN in Vercel env vars"));
      return;
    }

    const headersREST = {
      "User-Agent": "github-stats-card",
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    };

    // ---------- 1) REST: user data ----------
    const userRes = await fetch(`https://api.github.com/users/${username}`, { headers: headersREST });
    const user = await userRes.json();

    if (!user || user.message) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.status(200).send(errorSVG(`User not found: ${username}`));
      return;
    }

    const avatarBase64 = await fetchAsBase64(user.avatar_url);
    const avatarDataUri = `data:image/png;base64,${avatarBase64}`;

    const followers = user.followers ?? 0;
    const following = user.following ?? 0;
    const publicRepos = user.public_repos ?? 0;

    const name = escapeXML((user.name || username).slice(0, 18));
    const login = escapeXML(username);

    // ---------- 2) REST: stars ----------
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
      headers: headersREST,
    });
    const repos = await reposRes.json();
    const totalStars = Array.isArray(repos)
      ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
      : 0;

    // ---------- 3) REST: PRs/issues counts ----------
    const search = async (q) => {
      const r = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
        { headers: headersREST }
      );
      const data = await r.json();
      return data?.total_count || 0;
    };

    const totalPRs = await search(`type:pr author:${username}`);
    const totalIssues = await search(`type:issue author:${username}`);
    const mergedPRs = await search(`type:pr author:${username} is:merged`);

    // ---------- 4) GraphQL: contribution calendar (streak + dates) ----------
    const graphqlQuery = {
      query: `
        query($login:String!) {
          user(login:$login) {
            createdAt
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `,
      variables: { login: username },
    };

    const gqlRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    });

    const gql = await gqlRes.json();
    const gqlUser = gql?.data?.user;
    const cal = gqlUser?.contributionsCollection?.contributionCalendar;

    if (!cal) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.status(200).send(errorSVG("GraphQL error: contribution calendar missing"));
      return;
    }

    const startDateLabel = gqlUser?.createdAt ? formatDate(gqlUser.createdAt) : "—";

    const days = [];
    for (const w of cal.weeks || []) {
      for (const d of w.contributionDays || []) {
        days.push({ date: d.date, count: d.contributionCount });
      }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    const totalContributions = cal.totalContributions ?? 0;
    const streakInfo = computeStreaks(days);

    const currentStreak = streakInfo.current.length;
    const currentStart = streakInfo.current.start ? formatDate(streakInfo.current.start) : "—";
    const currentEnd = streakInfo.current.end ? formatDate(streakInfo.current.end) : "—";

    const longestStreak = streakInfo.longest.length;
    const longestStart = streakInfo.longest.start ? formatDate(streakInfo.longest.start) : "—";
    const longestEnd = streakInfo.longest.end ? formatDate(streakInfo.longest.end) : "—";

    // ---------- grade ----------
    let grade = "C";
    const score = totalStars + totalPRs * 2 + mergedPRs * 3;
    if (score > 5000) grade = "S";
    else if (score > 2000) grade = "A";
    else if (score > 800) grade = "B";

    // ---------- SVG sizes ----------
    const W = 920;
    const H = 440; // same height, only sections swapped

    // Layout Y constants
    const PROFILE_Y = 28;      // profile section start
    const STREAK_Y = 248;      // streak section start

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050705"/>
      <stop offset="100%" stop-color="#030503"/>
    </linearGradient>

    <radialGradient id="glow" cx="20%" cy="20%" r="80%">
      <stop offset="0%" stop-color="rgba(0,255,150,0.20)"/>
      <stop offset="100%" stop-color="rgba(0,255,150,0)"/>
    </radialGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" rx="26" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" rx="26" fill="url(#glow)"/>

  <!-- main border -->
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="22"
        fill="rgba(10,12,10,0.68)"
        stroke="rgba(0,255,150,0.22)"
        stroke-width="2"
        filter="url(#shadow)"/>

  <!-- ========================= -->
  <!--  TOP (2): PROFILE CARD ✅  -->
  <!-- ========================= -->

  <!-- Profile section background -->
  <rect x="34" y="${PROFILE_Y}" width="${W - 68}" height="200" rx="18"
        fill="rgba(0,0,0,0.33)"
        stroke="rgba(255,255,255,0.06)"/>

  <!-- Avatar -->
  <g transform="translate(52,${PROFILE_Y + 22})">
    <clipPath id="clip">
      <rect x="0" y="0" width="60" height="60" rx="16"/>
    </clipPath>
    <rect x="-4" y="-4" width="68" height="68" rx="18"
          fill="rgba(0,255,150,0.10)" stroke="rgba(0,255,150,0.22)"/>
    <image href="${avatarDataUri}" x="0" y="0" width="60" height="60" clip-path="url(#clip)"/>
  </g>

  <!-- Name -->
  <text x="134" y="${PROFILE_Y + 56}" font-size="22" font-weight="1000" fill="#E9FFF3"
        font-family="system-ui,Segoe UI,Roboto,Arial">${name}</text>
  <text x="134" y="${PROFILE_Y + 78}" font-size="12" font-weight="900"
        fill="rgba(210,255,232,0.65)"
        font-family="system-ui,Segoe UI,Roboto,Arial">@${login}</text>

  <!-- Mini cards -->
  ${miniBox(52, PROFILE_Y + 104, "Followers", followers, 260, 64)}
  ${miniBox(340, PROFILE_Y + 104, "Following", following, 260, 64)}
  ${miniBox(628, PROFILE_Y + 104, "Public Repos", publicRepos, 260, 64)}

  <!-- Stats (clear) -->
  <text x="70" y="${PROFILE_Y + 186}" font-size="14" font-weight="1000" fill="#DFFFEF"
        font-family="system-ui,Segoe UI,Roboto,Arial">GitHub Stats</text>

  ${rowLine(70, PROFILE_Y + 210, "Total Stars Earned", totalStars)}
  ${rowLine(70, PROFILE_Y + 232, "Total PRs", totalPRs)}
  ${rowLine(370, PROFILE_Y + 210, "Total Issues", totalIssues)}
  ${rowLine(370, PROFILE_Y + 232, "Merged PRs", mergedPRs)}

  <!-- Grade ring -->
  <g transform="translate(748,${PROFILE_Y + 132})">
    <circle cx="80" cy="32" r="42" stroke="rgba(0,255,150,0.14)" stroke-width="10" fill="none"/>
    <circle cx="80" cy="32" r="42" stroke="#00FF96" stroke-width="10" fill="none"
      stroke-linecap="round"
      stroke-dasharray="${calcDash(grade, 42)} 999"
      transform="rotate(-90 80 32)"/>
    <text x="80" y="40" text-anchor="middle" font-size="30" font-weight="1000" fill="#E9FFF3"
          font-family="system-ui,Segoe UI,Roboto,Arial">${grade}</text>
    <text x="80" y="58" text-anchor="middle" font-size="11" font-weight="900"
          fill="rgba(210,255,232,0.60)" font-family="system-ui,Segoe UI,Roboto,Arial">Grade</text>
  </g>

  <!-- ========================= -->
  <!--  BOTTOM (1): STREAK CARD ✅ -->
  <!-- ========================= -->

  <rect x="34" y="${STREAK_Y}" width="${W - 68}" height="160" rx="18"
        fill="rgba(0,0,0,0.33)"
        stroke="rgba(255,255,255,0.06)"/>

  <line x1="${W/3}" y1="${STREAK_Y + 18}" x2="${W/3}" y2="${STREAK_Y + 142}" stroke="rgba(255,255,255,0.09)"/>
  <line x1="${(W/3)*2}" y1="${STREAK_Y + 18}" x2="${(W/3)*2}" y2="${STREAK_Y + 142}" stroke="rgba(255,255,255,0.09)"/>

  <!-- LEFT: Total Contributions -->
  <text x="120" y="${STREAK_Y + 66}" text-anchor="middle" font-size="38" font-weight="1000"
        fill="#71ffa8" font-family="system-ui,Segoe UI,Roboto,Arial">${totalContributions}</text>
  <text x="120" y="${STREAK_Y + 94}" text-anchor="middle" font-size="13" font-weight="900"
        fill="#bfffe0" font-family="system-ui,Segoe UI,Roboto,Arial">Total Contributions</text>
  <text x="120" y="${STREAK_Y + 118}" text-anchor="middle" font-size="11" font-weight="800"
        fill="rgba(210,255,232,0.62)" font-family="system-ui,Segoe UI,Roboto,Arial">
    ${startDateLabel} - Present
  </text>

  <!-- MIDDLE: Current streak ring -->
  <g transform="translate(${(W/2)-70},${STREAK_Y + 30})">
    <circle cx="70" cy="44" r="36" stroke="rgba(113,255,168,0.18)" stroke-width="10" fill="none"/>
    <circle cx="70" cy="44" r="36" stroke="#71ffa8" stroke-width="10" fill="none"
            stroke-linecap="round"
            stroke-dasharray="${Math.min(240, 30 + currentStreak*12)} 999"
            transform="rotate(-90 70 44)"/>
    <text x="70" y="52" text-anchor="middle" font-size="26" font-weight="1000"
          fill="#E9FFF3" font-family="system-ui,Segoe UI,Roboto,Arial">${currentStreak}</text>
  </g>
  <text x="${W/2}" y="${STREAK_Y + 120}" text-anchor="middle" font-size="13" font-weight="1000"
        fill="#c8ffe7" font-family="system-ui,Segoe UI,Roboto,Arial">Current Streak</text>
  <text x="${W/2}" y="${STREAK_Y + 142}" text-anchor="middle" font-size="11" font-weight="800"
        fill="rgba(210,255,232,0.62)" font-family="system-ui,Segoe UI,Roboto,Arial">
    ${currentStart} - ${currentEnd}
  </text>

  <!-- RIGHT: Longest streak -->
  <text x="${W - 120}" y="${STREAK_Y + 66}" text-anchor="middle" font-size="38" font-weight="1000"
        fill="#71ffa8" font-family="system-ui,Segoe UI,Roboto,Arial">${longestStreak}</text>
  <text x="${W - 120}" y="${STREAK_Y + 94}" text-anchor="middle" font-size="13" font-weight="900"
        fill="#bfffe0" font-family="system-ui,Segoe UI,Roboto,Arial">Longest Streak</text>
  <text x="${W - 120}" y="${STREAK_Y + 118}" text-anchor="middle" font-size="11" font-weight="800"
        fill="rgba(210,255,232,0.62)" font-family="system-ui,Segoe UI,Roboto,Arial">
    ${longestStart} - ${longestEnd}
  </text>

  <!-- footer -->
  <text x="460" y="${H - 24}" text-anchor="middle" font-size="11" font-weight="800"
        fill="rgba(210,255,232,0.50)" font-family="system-ui,Segoe UI,Roboto,Arial">
    ⚡ Live Stats • Powered by GitHub API • Hosted on Vercel
  </text>
</svg>`.trim();

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600"
    );
    res.status(200).send(svg);
  } catch (e) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(errorSVG("Error generating card"));
  }
}

/* ---------- helpers ---------- */
function escapeXML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function miniBox(x, y, label, value, w = 256, h = 74) {
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16"
          fill="rgba(0,0,0,0.35)"
          stroke="rgba(255,255,255,0.06)"/>
    <text x="${x + 18}" y="${y + 24}" font-size="11" font-weight="900"
          fill="rgba(210,255,232,0.60)" font-family="system-ui,Segoe UI,Roboto,Arial">${label}</text>
    <text x="${x + 18}" y="${y + 52}" font-size="22" font-weight="1000"
          fill="#00FF96" font-family="system-ui,Segoe UI,Roboto,Arial">${value}</text>
  </g>`;
}

function rowLine(x, y, label, value) {
  return `
  <g>
    <text x="${x}" y="${y}" font-size="13" font-weight="900"
          fill="rgba(210,255,232,0.72)" font-family="system-ui,Segoe UI,Roboto,Arial">${label}</text>
    <text x="${x + 240}" y="${y}" font-size="14" font-weight="1000"
          fill="#E9FFF3" font-family="system-ui,Segoe UI,Roboto,Arial">${value}</text>
  </g>`;
}

function calcDash(grade, r) {
  const total = Math.floor(2 * Math.PI * r);
  const pct = grade === "S" ? 0.95 : grade === "A" ? 0.8 : grade === "B" ? 0.6 : 0.4;
  return Math.floor(total * pct);
}

function errorSVG(msg) {
  const safe = escapeXML(msg);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="920" height="200">
  <rect width="100%" height="100%" rx="22" fill="#050705"/>
  <text x="50%" y="50%" text-anchor="middle" fill="#00ff96"
    font-family="system-ui,Segoe UI,Roboto,Arial" font-weight="900" font-size="18">${safe}</text>
</svg>`.trim();
}

async function fetchAsBase64(url) {
  const r = await fetch(url);
  const arr = new Uint8Array(await r.arrayBuffer());
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return Buffer.from(binary, "binary").toString("base64");
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const m = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m} ${day}, ${y}`;
}

function computeStreaks(days) {
  const isContrib = (d) => d && d.count > 0;

  // current streak
  let i = days.length - 1;
  while (i >= 0 && !isContrib(days[i])) i--;
  let curLen = 0,
    curStart = null,
    curEnd = null;
  if (i >= 0) {
    curEnd = days[i].date;
    while (i >= 0 && isContrib(days[i])) {
      curStart = days[i].date;
      curLen++;
      i--;
    }
  }

  // longest streak
  let bestLen = 0,
    bestStart = null,
    bestEnd = null;
  let runLen = 0,
    runStart = null;

  for (let j = 0; j < days.length; j++) {
    if (isContrib(days[j])) {
      if (runLen === 0) runStart = days[j].date;
      runLen++;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
        bestEnd = days[j].date;
      }
    } else {
      runLen = 0;
      runStart = null;
    }
  }

  return {
    current: { length: curLen, start: curStart, end: curEnd },
    longest: { length: bestLen, start: bestStart, end: bestEnd },
  };
}
