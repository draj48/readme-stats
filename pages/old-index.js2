export async function getServerSideProps() {
  const username = "draj48";

  const headers = {
    "User-Agent": "github-stats-page",
    Accept: "application/vnd.github+json",
  };

  // fetch repos (for stars)
  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=100`,
    { headers }
  );
  const repos = await reposRes.json();

  const totalStars = Array.isArray(repos)
    ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
    : 0;

  // fetch user info
  const userRes = await fetch(`https://api.github.com/users/${username}`, {
    headers,
  });
  const user = await userRes.json();

  // NOTE:
  // GitHub API public endpoints don't provide total commits/PRs/issues directly.
  // For accurate totals we will use GitHub Search API:
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

  // grade logic (simple)
  let grade = "C";
  const score = totalStars + totalPRs * 2 + contributedTo * 3;
  if (score > 5000) grade = "S";
  else if (score > 2000) grade = "A";
  else if (score > 800) grade = "B";
  else grade = "C";

  return {
    props: {
      username,
      totalStars,
      totalPRs,
      totalIssues,
      contributedTo,
      grade,
      name: user?.name || username,
    },
  };
}

export default function Home(props) {
  const {
    name,
    totalStars,
    totalPRs,
    totalIssues,
    contributedTo,
    grade,
  } = props;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ flex: 1 }}>
          <h2 style={styles.title}>{name}'s GitHub Stats</h2>

          <div style={styles.row}>
            <span>Total Stars Earned:</span>
            <b>{totalStars}</b>
          </div>

          <div style={styles.row}>
            <span>Total PRs:</span>
            <b>{totalPRs}</b>
          </div>

          <div style={styles.row}>
            <span>Total Issues:</span>
            <b>{totalIssues}</b>
          </div>

          <div style={styles.row}>
            <span>Contributed to (merged PRs):</span>
            <b>{contributedTo}</b>
          </div>
        </div>

        <div style={styles.gradeWrap}>
          <div style={styles.ring}>
            <div style={styles.grade}>{grade}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b1220",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    width: 720,
    maxWidth: "100%",
    background: "white",
    borderRadius: 12,
    padding: 26,
    display: "flex",
    gap: 30,
    boxShadow: "0 15px 50px rgba(0,0,0,0.25)",
  },
  title: {
    margin: 0,
    marginBottom: 16,
    color: "#2b5cff",
    fontWeight: 800,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid rgba(0,0,0,0.07)",
    fontSize: 15,
  },
  gradeWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 160,
  },
  ring: {
    width: 120,
    height: 120,
    borderRadius: "50%",
    border: "10px solid rgba(43,92,255,0.25)",
    borderTopColor: "#2b5cff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  grade: {
    fontSize: 42,
    fontWeight: 900,
    color: "#1c2a44",
  },
};
