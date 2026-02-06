exports.getServices = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: 1,
        message: "user_id обязателен"
      });
    }

    // вызов MIS
    const response = await fetch("https://app.rnova.org/api/public/getServices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MIS_TOKEN}`
      },
      body: JSON.stringify({ user_id })
    });

    const text = await response.text();

    if (!response.ok || text.startsWith("<!DOCTYPE")) {
      return res.status(502).json({
        error: 1,
        message: "Ошибка MIS"
      });
    }

    const data = JSON.parse(text);

    res.json(data);

  } catch (err) {
    console.error("getServices error:", err);
    res.status(500).json({
      error: 1,
      message: "Server error"
    });
  }
};
