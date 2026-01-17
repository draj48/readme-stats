export async function getServerSideProps() {
  const username = "draj48";

  const headers = {
    "User-Agent": "github-stats-page",
    Accept: "application/vnd.github+json",
  };

  // user info
  const userRes = await fetch(`https://api.github.com/users/${username}`, {
    headers,
  });
  const user = await userRes.json();

  // repos for stars
  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=100`,
    { headers }
  );
  const repos = await reposRes.json();

  const totalStars = Array.isArray(repos)
    ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
    : 0;

  // search counts
  const search = async (q) => {
    const res = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
      { headers }
    );
    const data = await res.json();
    return data.total_count || 0;
  };

  const totalPRs = await search(`type:pr author:${username}`);
  const totalIssues = await search(`type:issue author:${username}`);
  const contributedTo = await search(`type:pr author:${username} is:merged`);

  // grade (simple)
  let grade = "C";
  const score = totalStars + totalPRs * 2 + contributedTo * 3;
  if (score > 5000) grade = "S";
  else if (score > 2000) grade = "A";
  else if (score > 800) grade = "B";

  return {
    props: {
      username,
      name: user?.name || username,
      avatar: user?.avatar_url || "",
      followers: user?.followers ?? 0,
      following: user?.following ?? 0,
      publicRepos: user?.public_repos ?? 0,
      totalStars,
      totalPRs,
      totalIssues,
      contributedTo,
      grade,
    },
  };
}

export default function Home(props) {
  const {
    username,
    name,
    avatar,
    followers,
    following,
    publicRepos,
    totalStars,
    totalPRs,
    totalIssues,
    contributedTo,
    grade,
  } = props;

  return (
    <div style={styles.page}>
      {/* Background glow */}
      <div style={styles.glow1} />
      <div style={styles.glow2} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.profile}>
            <img src={avatar} alt="avatar" style={styles.avatar} />
            <div>
              <div style={styles.title}>{name}</div>
              <div style={styles.subTitle}>@{username}</div>
            </div>
          </div>

          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noreferrer"
            style={styles.githubBtn}
          >
            View GitHub ↗
          </a>
        </div>

        {/* Mini Stats */}
        <div style={styles.miniGrid}>
          <MiniStat label="Followers" value={followers} />
          <MiniStat label="Following" value={following} />
          <MiniStat label="Public Repos" value={publicRepos} />
        </div>

        {/* Main content */}
        <div style={styles.main}>
          <div style={{ flex: 1 }}>
            <div style={styles.sectionTitle}>GitHub Stats</div>

            <Row label="Total Stars Earned" value={totalStars} />
            <Row label="Total PRs" value={totalPRs} />
            <Row label="Total Issues" value={totalIssues} />
            <Row label="Merged PRs" value={contributedTo} />
          </div>

          <div style={styles.gradeWrap}>
            <div style={styles.ring}>
              <div style={styles.grade}>{grade}</div>
              <div style={styles.gradeLabel}>Grade</div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          Auto-updated from GitHub API • Hosted on Vercel
        </div>
      </div>
    </div>
  );
}

/* components */
function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <b style={styles.rowValue}>{value}</b>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={styles.miniCard}>
      <div style={styles.miniLabel}>{label}</div>
      <div style={styles.miniValue}>{value}</div>
    </div>
  );
}

/* styles */
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at top, #0b0f0d 0%, #050705 55%, #020302 100%)",
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    position: "relative",
    overflow: "hidden",
  },

  glow1: {
    position: "absolute",
    width: 700,
    height: 700,
    borderRadius: "50%",
    background: "rgba(0, 255, 150, 0.10)",
    filter: "blur(80px)",
    top: -250,
    left: -250,
  },
  glow2: {
    position: "absolute",
    width: 700,
    height: 700,
    borderRadius: "50%",
    background: "rgba(0, 255, 90, 0.10)",
    filter: "blur(90px)",
    bottom: -250,
    right: -250,
  },

  card: {
    width: 820,
    maxWidth: "100%",
    borderRadius: 18,
    padding: 22,
    background: "rgba(10, 12, 10, 0.85)",
    border: "1px solid rgba(0, 255, 150, 0.18)",
    boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
    backdropFilter: "blur(10px)",
    zIndex: 2,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  profile: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    border: "1px solid rgba(0,255,150,0.35)",
    boxShadow: "0 0 0 4px rgba(0,255,150,0.08)",
  },

  title: {
    fontSize: 20,
    fontWeight: 900,
    color: "#eafff3",
    letterSpacing: 0.2,
  },
  subTitle: {
    fontSize: 13,
    color: "rgba(210,255,232,0.65)",
    marginTop: 2,
  },

  githubBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,255,150,0.25)",
    background: "rgba(0,255,150,0.08)",
    color: "#bfffe0",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
  },

  miniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 18,
  },

  miniCard: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  miniLabel: {
    color: "rgba(210,255,232,0.6)",
    fontSize: 12,
    fontWeight: 700,
  },
  miniValue: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: 900,
    color: "#00ff96",
  },

  main: { display: "flex", gap: 24, alignItems: "center" },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#dfffee",
    marginBottom: 10,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 14,
  },
  rowLabel: { color: "rgba(210,255,232,0.72)", fontWeight: 700 },
  rowValue: { color: "#eafff3" },

  gradeWrap: {
    minWidth: 170,
    display: "flex",
    justifyContent: "center",
  },
  ring: {
    width: 135,
    height: 135,
    borderRadius: "50%",
    border: "10px solid rgba(0,255,150,0.12)",
    borderTopColor: "#00ff96",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 6px rgba(0,255,150,0.05)",
  },
  grade: { fontSize: 44, fontWeight: 1000, color: "#eafff3", lineHeight: 1 },
  gradeLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(210,255,232,0.6)",
  },

  footer: {
    marginTop: 16,
    fontSize: 12,
    color: "rgba(210,255,232,0.55)",
    textAlign: "center",
  },
};
