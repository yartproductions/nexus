// NEXUS YouTube Playlist API
// Add YOUTUBE_API_KEY to Vercel Environment Variables.

function isoDurationToClock(iso = "") {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "--:--";

  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const key = process.env.YOUTUBE_API_KEY;
  const listId = String(req.query?.list || "").trim();

  if (!key) {
    return res.status(500).json({
      error: "Missing YOUTUBE_API_KEY in Vercel Environment Variables."
    });
  }

  if (!listId) {
    return res.status(400).json({
      error: "Missing playlist id."
    });
  }

  try {
    let tracks = [];
    let pageToken = "";
    let pages = 0;

    while (pages < 10) {
      const params = new URLSearchParams({
        part: "snippet,contentDetails",
        maxResults: "50",
        playlistId: listId,
        key
      });

      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || `YouTube returned ${response.status}`
        );
      }

      for (const item of data.items || []) {
        const videoId =
          item?.contentDetails?.videoId ||
          item?.snippet?.resourceId?.videoId;

        if (!videoId) continue;

        tracks.push({
          videoId,
          title: item?.snippet?.title || "Untitled",
          channelTitle: item?.snippet?.videoOwnerChannelTitle ||
                        item?.snippet?.channelTitle ||
                        "YouTube",
          position: item?.snippet?.position ?? tracks.length,
          duration: "--:--"
        });
      }

      pageToken = data.nextPageToken || "";
      pages += 1;

      if (!pageToken) break;
    }

    // Fetch durations in groups of 50.
    for (let i = 0; i < tracks.length; i += 50) {
      const batch = tracks.slice(i, i + 50);
      const ids = batch.map(t => t.videoId).join(",");

      const params = new URLSearchParams({
        part: "contentDetails",
        id: ids,
        key
      });

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${params}`
      );

      const data = await response.json();

      if (response.ok) {
        const durationMap = new Map(
          (data.items || []).map(v => [
            v.id,
            isoDurationToClock(v?.contentDetails?.duration || "")
          ])
        );

        for (const track of batch) {
          track.duration = durationMap.get(track.videoId) || "--:--";
        }
      }
    }

    tracks.sort((a, b) => a.position - b.position);

    return res.status(200).json({
      ok: true,
      playlistId: listId,
      count: tracks.length,
      tracks
    });

  } catch (error) {
    return res.status(500).json({
      error: "YouTube playlist sync failed",
      details: error.message
    });
  }
}
