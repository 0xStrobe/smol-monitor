// GET the urls and check the headers to see if cache is expired
// then send a summary to discord using the webhook

import "https://deno.land/x/dotenv@v3.2.0/load.ts";

const USER_AGENT = "llama-api-monitor-smol";
const MONITOR_WEBHOOK = Deno.env.get("MONITOR_WEBHOOK") || "";
const INTERVAL = Deno.env.get("INTERVAL") || "15";

console.log(`smol monitor has started, interval: ${INTERVAL} minutes`);

const urls = [
  // HTML
  "https://defillama.com/yields",
  "https://defillama.com/",
  "https://defillama.com/chains",
  "https://defillama.com/stablecoins",
  "https://defillama.com/stablecoins/chains",

  // API
  "https://api.llama.fi/protocols",
  "https://api.llama.fi/protocol/Lido", // multiple
  "https://api.llama.fi/updatedProtocol/Lido", // multiple
  "https://api.llama.fi/charts",
  "https://api.llama.fi/charts/Ethereum", // multiple
  "https://api.llama.fi/tvl/Lido", // multiple
  "https://api.llama.fi/chains",

  // Stablecoins
  "https://stablecoins.llama.fi/stablecoins",
  "https://stablecoins.llama.fi/stablecoincharts/all",
  "https://stablecoins.llama.fi/stablecoincharts/Ethereum", // multiple
  "https://stablecoins.llama.fi/stablecoin/tether", // multiple
  "https://stablecoins.llama.fi/stablecoinchains",
  "https://stablecoins.llama.fi/stablecoinprices",

  // Yields
  "https://yields.llama.fi/pools",
  "https://yields.llama.fi/chart/747c1d2a-c668-4682-b9f9-296708a3dd90", // multiple

  // Internal
  "https://api.llama.fi/lite/protocols2",
  "https://api.llama.fi/lite/charts",
  "https://api.llama.fi/lite/charts/Ethereum", // multiple
];

const sendMessage = async (message: string) => {
  const response = await fetch(MONITOR_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "```\n" + message + "\n```",
    }),
  });
  return response;
};

const checkUrl = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  const now = new Date();
  const headers = response.headers;
  const cacheControl = headers.get("cache-control") || "";
  const expires = headers.get("expires") || "";
  const cfCacheStatus = headers.get("cf-cache-status") || "";
  const age = headers.get("age") || "";
  const lastModified = headers.get("last-modified") || "";

  const isExpired = cfCacheStatus === "EXPIRED" || !!(lastModified && new Date(lastModified).getTime() < now.getTime() - 3600e3 * 1.5);

  let message = url;
  if (isExpired) {
    if (cacheControl) {
      message += "\n" + "[cache-control] " + cacheControl;
    }
    if (expires) {
      message += "\n" + "[expires] " + expires;
    }
    if (age) {
      message += "\n" + "[age] " + age;
    }
    if (lastModified) {
      message += "\n" + "[last-modified] " + lastModified;
    }
    message += "\n" + "[cf-cache-status] " + cfCacheStatus;
  }

  return {
    url,
    isExpired,
    message,
  };
};

const checkUrls = async () => {
  try {
    const startupMessage = "========= checking urls =========\n" + new Date().toUTCString();
    console.log(startupMessage);
    // await sendMessage(startupMessage);
    const results = await Promise.all(
      urls.map(async (url) => {
        await checkUrl(url);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await checkUrl(url);
        await new Promise((resolve) => setTimeout(resolve, 13000));
        const res = await checkUrl(url);
        return res;
      })
    );

    const expired = results.filter((result) => result.isExpired);
    if (expired.length > 0) {
      const message = expired.map((result) => result.message).join("\n--------------------\n");
      console.log(message);
      await sendMessage(message);
    } else {
      console.log("all good");
    }
  } catch (e) {
    console.error(e);
    await sendMessage(e.message.split("\n")[0] || e.message);
  }
};

const main = async () => {
  await checkUrls();
  setInterval(checkUrls, 1000 * 60 * Number(INTERVAL));
};

main();
