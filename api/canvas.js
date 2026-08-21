export default async function handler(req, res) {
  try {
    const canvasUrl = process.env.CANVAS_URL;
    const token = process.env.CANVAS_TOKEN;

    if (!canvasUrl || !token) {
      return res.status(500).json({
        error: "Canvas environment variables are missing."
      });
    }

    const response = await fetch(
      `${canvasUrl}/api/v1/users/self/upcoming_events`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();

      return res.status(response.status).json({
        error: "Canvas request failed.",
        details: text
      });
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Server error.",
      details: error.message
    });
  }
}
