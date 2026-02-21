"use strict";

const AppsStorage = (() => {
  const STORAGE_KEY = "pinnedApps";

  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function _write(apps) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    } catch (e) {
      console.warn("[AppsStorage] write failed:", e);
    }
  }

  function _domainLabel(url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      const root = hostname.split(".")[0];
      return root.charAt(0).toUpperCase() + root.slice(1);
    } catch {
      return url;
    }
  }

  function _faviconUrl(url) {
    try {
      const hostname = new URL(url).hostname;
      return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
    } catch {
      return "";
    }
  }

  function getApps() {
    return _read();
  }

  function addApp({ url, name }) {
    if (!url || typeof url !== "string") throw new Error("url is required");
    let normalised = url.trim();
    if (!/^https?:\/\//i.test(normalised)) normalised = "https://" + normalised;

    const apps = _read();
    const app = {
      id: _genId(),
      name: (name && name.trim()) || _domainLabel(normalised),
      url: normalised,
      icon: _faviconUrl(normalised),
      createdAt: Date.now(),
    };
    apps.push(app);
    _write(apps);
    return app;
  }

  function removeApp(id) {
    const apps = _read().filter((a) => a.id !== id);
    _write(apps);
  }

  function updateApp(id, patches) {
    const apps = _read();
    const idx = apps.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    apps[idx] = { ...apps[idx], ...patches };
    _write(apps);
    return apps[idx];
  }

  function clearApps() {
    _write([]);
  }

  const _DEFAULT_APPS = [
    {
      id: "app0001",
      name: "Gmail",
      url: "https://mail.google.com",
      icon: "https://icons.duckduckgo.com/ip3/mail.google.com.ico",
      createdAt: 1771705073412,
    },
    {
      id: "app0002",
      name: "Google Drive",
      url: "https://drive.google.com",
      icon: "https://icons.duckduckgo.com/ip3/drive.google.com.ico",
      createdAt: 1771705073413,
    },
    {
      id: "app0003",
      name: "Google Docs",
      url: "https://docs.google.com",
      icon: "https://icons.duckduckgo.com/ip3/docs.google.com.ico",
      createdAt: 1771705073414,
    },
    {
      id: "app0004",
      name: "Google Sheets",
      url: "https://sheets.google.com",
      icon: "https://icons.duckduckgo.com/ip3/sheets.google.com.ico",
      createdAt: 1771705073415,
    },
    {
      id: "app0005",
      name: "Google Calendar",
      url: "https://calendar.google.com",
      icon: "https://icons.duckduckgo.com/ip3/calendar.google.com.ico",
      createdAt: 1771705073416,
    },
    {
      id: "app0006",
      name: "Notion",
      url: "https://notion.so",
      icon: "https://icons.duckduckgo.com/ip3/notion.so.ico",
      createdAt: 1771705073417,
    },
    {
      id: "app0007",
      name: "Trello",
      url: "https://trello.com",
      icon: "https://icons.duckduckgo.com/ip3/trello.com.ico",
      createdAt: 1771705073418,
    },
    {
      id: "app0008",
      name: "ClickUp",
      url: "https://clickup.com",
      icon: "https://icons.duckduckgo.com/ip3/clickup.com.ico",
      createdAt: 1771705073419,
    },
    {
      id: "app0009",
      name: "Obsidian Publish",
      url: "https://obsidian.md",
      icon: "https://icons.duckduckgo.com/ip3/obsidian.md.ico",
      createdAt: 1771705073420,
    },
    {
      id: "app0010",
      name: "Canva",
      url: "https://canva.com",
      icon: "https://icons.duckduckgo.com/ip3/canva.com.ico",
      createdAt: 1771705073421,
    },
    {
      id: "app0011",
      name: "GitHub",
      url: "https://github.com",
      icon: "https://icons.duckduckgo.com/ip3/github.com.ico",
      createdAt: 1771705073422,
    },
    {
      id: "app0012",
      name: "GitLab",
      url: "https://gitlab.com",
      icon: "https://icons.duckduckgo.com/ip3/gitlab.com.ico",
      createdAt: 1771705073423,
    },
    {
      id: "app0013",
      name: "Bitbucket",
      url: "https://bitbucket.org",
      icon: "https://icons.duckduckgo.com/ip3/bitbucket.org.ico",
      createdAt: 1771705073424,
    },
    {
      id: "app0014",
      name: "Stack Overflow",
      url: "https://stackoverflow.com",
      icon: "https://icons.duckduckgo.com/ip3/stackoverflow.com.ico",
      createdAt: 1771705073425,
    },
    {
      id: "app0015",
      name: "MDN Docs",
      url: "https://developer.mozilla.org",
      icon: "https://icons.duckduckgo.com/ip3/developer.mozilla.org.ico",
      createdAt: 1771705073426,
    },
    {
      id: "app0016",
      name: "DevDocs",
      url: "https://devdocs.io",
      icon: "https://icons.duckduckgo.com/ip3/devdocs.io.ico",
      createdAt: 1771705073427,
    },
    {
      id: "app0017",
      name: "LeetCode",
      url: "https://leetcode.com",
      icon: "https://icons.duckduckgo.com/ip3/leetcode.com.ico",
      createdAt: 1771705073428,
    },
    {
      id: "app0018",
      name: "HackerRank",
      url: "https://hackerrank.com",
      icon: "https://icons.duckduckgo.com/ip3/hackerrank.com.ico",
      createdAt: 1771705073429,
    },
    {
      id: "app0019",
      name: "Kaggle",
      url: "https://kaggle.com",
      icon: "https://icons.duckduckgo.com/ip3/kaggle.com.ico",
      createdAt: 1771705073430,
    },
    {
      id: "app0020",
      name: "HuggingFace",
      url: "https://huggingface.co",
      icon: "https://icons.duckduckgo.com/ip3/huggingface.co.ico",
      createdAt: 1771705073431,
    },
    {
      id: "app0021",
      name: "ChatGPT",
      url: "https://chat.openai.com",
      icon: "https://icons.duckduckgo.com/ip3/chat.openai.com.ico",
      createdAt: 1771705073432,
    },
    {
      id: "app0022",
      name: "Claude",
      url: "https://claude.ai",
      icon: "https://icons.duckduckgo.com/ip3/claude.ai.ico",
      createdAt: 1771705073433,
    },
    {
      id: "app0023",
      name: "Perplexity",
      url: "https://perplexity.ai",
      icon: "https://icons.duckduckgo.com/ip3/perplexity.ai.ico",
      createdAt: 1771705073434,
    },
    {
      id: "app0024",
      name: "Google AI Studio",
      url: "https://aistudio.google.com",
      icon: "https://icons.duckduckgo.com/ip3/aistudio.google.com.ico",
      createdAt: 1771705073435,
    },
    {
      id: "app0025",
      name: "OpenAI Platform",
      url: "https://platform.openai.com",
      icon: "https://icons.duckduckgo.com/ip3/platform.openai.com.ico",
      createdAt: 1771705073436,
    },
    {
      id: "app0026",
      name: "AWS Console",
      url: "https://console.aws.amazon.com",
      icon: "https://icons.duckduckgo.com/ip3/console.aws.amazon.com.ico",
      createdAt: 1771705073437,
    },
    {
      id: "app0027",
      name: "Google Cloud",
      url: "https://console.cloud.google.com",
      icon: "https://icons.duckduckgo.com/ip3/console.cloud.google.com.ico",
      createdAt: 1771705073438,
    },
    {
      id: "app0028",
      name: "Azure Portal",
      url: "https://portal.azure.com",
      icon: "https://icons.duckduckgo.com/ip3/portal.azure.com.ico",
      createdAt: 1771705073439,
    },
    {
      id: "app0029",
      name: "Cloudflare",
      url: "https://dash.cloudflare.com",
      icon: "https://icons.duckduckgo.com/ip3/dash.cloudflare.com.ico",
      createdAt: 1771705073440,
    },
    {
      id: "app0030",
      name: "DigitalOcean",
      url: "https://cloud.digitalocean.com",
      icon: "https://icons.duckduckgo.com/ip3/cloud.digitalocean.com.ico",
      createdAt: 1771705073441,
    },
    {
      id: "app0031",
      name: "Vercel",
      url: "https://vercel.com",
      icon: "https://icons.duckduckgo.com/ip3/vercel.com.ico",
      createdAt: 1771705073442,
    },
    {
      id: "app0032",
      name: "Netlify",
      url: "https://app.netlify.com",
      icon: "https://icons.duckduckgo.com/ip3/app.netlify.com.ico",
      createdAt: 1771705073443,
    },
    {
      id: "app0033",
      name: "Docker Hub",
      url: "https://hub.docker.com",
      icon: "https://icons.duckduckgo.com/ip3/hub.docker.com.ico",
      createdAt: 1771705073444,
    },
    {
      id: "app0034",
      name: "Kubernetes Docs",
      url: "https://kubernetes.io",
      icon: "https://icons.duckduckgo.com/ip3/kubernetes.io.ico",
      createdAt: 1771705073445,
    },
    {
      id: "app0035",
      name: "Postman",
      url: "https://postman.com",
      icon: "https://icons.duckduckgo.com/ip3/postman.com.ico",
      createdAt: 1771705073446,
    },
    {
      id: "app0036",
      name: "Jira",
      url: "https://jira.atlassian.com",
      icon: "https://icons.duckduckgo.com/ip3/jira.atlassian.com.ico",
      createdAt: 1771705073447,
    },
    {
      id: "app0037",
      name: "Confluence",
      url: "https://confluence.atlassian.com",
      icon: "https://icons.duckduckgo.com/ip3/confluence.atlassian.com.ico",
      createdAt: 1771705073448,
    },
    {
      id: "app0038",
      name: "Figma",
      url: "https://figma.com",
      icon: "https://icons.duckduckgo.com/ip3/figma.com.ico",
      createdAt: 1771705073449,
    },
    {
      id: "app0039",
      name: "Linear",
      url: "https://linear.app",
      icon: "https://icons.duckduckgo.com/ip3/linear.app.ico",
      createdAt: 1771705073450,
    },
    {
      id: "app0040",
      name: "Hashnode",
      url: "https://hashnode.com",
      icon: "https://icons.duckduckgo.com/ip3/hashnode.com.ico",
      createdAt: 1771705073451,
    },
    {
      id: "app0041",
      name: "Medium",
      url: "https://medium.com",
      icon: "https://icons.duckduckgo.com/ip3/medium.com.ico",
      createdAt: 1771705073452,
    },
    {
      id: "app0042",
      name: "Coursera",
      url: "https://coursera.org",
      icon: "https://icons.duckduckgo.com/ip3/coursera.org.ico",
      createdAt: 1771705073453,
    },
    {
      id: "app0043",
      name: "Udemy",
      url: "https://udemy.com",
      icon: "https://icons.duckduckgo.com/ip3/udemy.com.ico",
      createdAt: 1771705073454,
    },
    {
      id: "app0044",
      name: "edX",
      url: "https://edx.org",
      icon: "https://icons.duckduckgo.com/ip3/edx.org.ico",
      createdAt: 1771705073455,
    },
    {
      id: "app0045",
      name: "arXiv",
      url: "https://arxiv.org",
      icon: "https://icons.duckduckgo.com/ip3/arxiv.org.ico",
      createdAt: 1771705073456,
    },
    {
      id: "app0046",
      name: "Amazon",
      url: "https://amazon.in",
      icon: "https://icons.duckduckgo.com/ip3/amazon.in.ico",
      createdAt: 1771705073457,
    },
    {
      id: "app0047",
      name: "Flipkart",
      url: "https://flipkart.com",
      icon: "https://icons.duckduckgo.com/ip3/flipkart.com.ico",
      createdAt: 1771705073458,
    },
    {
      id: "app0048",
      name: "Google Keep",
      url: "https://keep.google.com",
      icon: "https://icons.duckduckgo.com/ip3/keep.google.com.ico",
      createdAt: 1771705073459,
    },
    {
      id: "app0049",
      name: "Zoom",
      url: "https://zoom.us",
      icon: "https://icons.duckduckgo.com/ip3/zoom.us.ico",
      createdAt: 1771705073460,
    },
    {
      id: "app0050",
      name: "Microsoft Teams",
      url: "https://teams.microsoft.com",
      icon: "https://icons.duckduckgo.com/ip3/teams.microsoft.com.ico",
      createdAt: 1771705073461,
    },
  ];

  function _seedIfFirstRun() {
    if (localStorage.getItem(STORAGE_KEY) === null) {
      _write(_DEFAULT_APPS);
    }
  }

  _seedIfFirstRun();

  return Object.freeze({ getApps, addApp, removeApp, updateApp, clearApps });
})();
