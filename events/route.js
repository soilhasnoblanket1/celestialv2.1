const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const app = express();
const Confession = require("../models/confession.js");
const Comment = require("../models/comment.model");
const path = require("path");
const rateLimitMiddleware = require('./api.js');

app.use(rateLimitMiddleware);

app.get("/", (req, res, next) => {
  if (req.vpnDetected === true) {
    console.log(`VPN detected for IP ${req.ip}. Redirecting to /static/err403`);
    return res.status(401).redirect("/static/vpnblock");
  }

  Confession.find().then((confessions) => {
    function formatTimeDifference(date) {
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffDay > 0) {
        return `${diffDay} days ago`;
      } else if (diffHr > 0) {
        return `${diffHr} hours ago`;
      } else if (diffMin > 0) {
        return `${diffMin} minutes ago`;
      } else {
        return `a few seconds ago`;
      }
    }
    res.render("index", {
      confessions: confessions,
      formatTimeDifference,
    });
  });
});

app.get("/sabal", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "html", "html", "sabal.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "html", "html", "game.html"));
});

app.get("/nav", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "html", "html", "nav.html"));
});

app.get("/static/deleted", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "error", "deleted.html"));
});

app.get("/static/vpnblock", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "error", "vpnblock.html"));
});

app.get("/static/errcaptcha", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "error", "errcaptcha.html"));
});

app.get("/static/tos", (req, res) => {
  res.render("tos");
});

app.get("/static/err400", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "error", "error400.html"));
});

app.get("/static/err401", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "error", "toomanyrequest.html"));
});

app.use(bodyParser.urlencoded({ extended: true }));

mongoose
  .connect(
    "mongodb+srv://soilbhai:saurav@soil.zvhk0qg.mongodb.net/?retryWrites=true&w=majority&appName=soil",
    { useNewUrlParser: true, useUnifiedTopology: true },
  )
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

//
app.get("/deleteconfession", (req, res) => {
  Confession.find().then((confessions) => {
    res.render("delete", { confessions: confessions });
  });
});

function formatTimeDifference(createdAt) {
  const currentTime = new Date();
  const timeDifference = currentTime - createdAt;
  const seconds = Math.floor(timeDifference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1? 's' : ''} ago`;
  } else {
    return `${seconds} second${seconds > 1? 's' : ''} ago`;
  }
}


app.get('/api/confessions', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
    const totalConfessions = await Confession.countDocuments();
    const confessions = await Confession.aggregate([
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'confession',
          as: 'comments'
        }
      }
    ]).skip((page - 1) * limit).limit(limit);

    res.json({ confessions, totalConfessions, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/feed', async (req, res) => {
  function formatTimeDifference(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffDay > 0) {
      return `${diffDay} days ago`;
    } else if (diffHr > 0) {
      return `${diffHr} hours ago`;
    } else if (diffMin > 0) {
      return `${diffMin} minutes ago`;
    } else {
      return `a few seconds ago`;
    }
  }

  try {
    const confessions = await Confession.aggregate([
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'confession',
          as: 'comments'
        }
      }
    ]);

    res.render('feed', { confessions, formatTimeDifference });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/bin/cementglazeddoughnuts/adminpanel", (req, res) => {
  Confession.find()
   .then((confessions) => {
      res.render("admin", { 
        confessions: confessions,
        formatTimeDifference,
      });
    })
   .catch((err) => {
      console.error(err);
      res
       .status(500)
       .json({ error: "An error occurred while fetching confessions" });
    });
});

app.get('/confession/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send('Invalid confession ID');
    }

    const confession = await Confession.findById(id);
    if (!confession) {
      return res.status(404).send('Confession not found');
    }

    console.log('Confession:', confession);

    const comments = await Comment.find({ confession: new mongoose.Types.ObjectId(id) }).catch((err) => {
      console.error('Error fetching comments:', err);
      res.status(500).send('Error fetching comments');
    });

    res.render('confession', { confession, comments, formatTimeDifference });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post("/post/:id", async (req, res) => {
  try {
    const confessionId = new mongoose.Types.ObjectId(req.params.id);
    const confession = await Confession.findById(confessionId);
    if (!confession) {
      return res.status(404).json({ error: "Confession not found" });
    }

    if (!req.body.text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const comment = new Comment({
      text: req.body.text,
      confession: confessionId,
    });
    await comment.save();
    res.redirect('back');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

module.exports = app;
