// src/index.js
const express = require("express");
const {
  client,
  createTables,
  createUser,
  createItem,
  createReview,
  createComment,
  fetchItems,
  fetchItemDetails,
  fetchReviews,
  fetchUserComments,
  deleteReview,
  deleteComment,
  updateReview,
  updateComment,
  authenticate,
  findUserWithToken,
  createUserAndGenerateToken,
} = require("./db");

const app = express();

app.use(express.json());

const isLoggedIn = async (req, res, next) => {
  try {
    req.user = await findUserWithToken(req.headers.authorization);
    next();
  } catch (ex) {
    next(ex);
  }
};

app.post("/api/auth/login", async (req, res, next) => {
  try {
    res.send(await authenticate(req.body));
  } catch (ex) {
    next(ex);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    res.send(await createUserAndGenerateToken(req.body));
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/auth/me", isLoggedIn, (req, res, next) => {
  try {
    res.send(req.user);
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/items", async (req, res, next) => {
  try {
    const search = req.query.search || "";
    res.send(await fetchItems(search));
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/items/:id", async (req, res, next) => {
  try {
    res.send(await fetchItemDetails(req.params.id));
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/items/:id/reviews", async (req, res, next) => {
  try {
    res.send(await fetchReviews(req.params.id));
  } catch (ex) {
    next(ex);
  }
});

app.post("/api/items/:id/reviews", isLoggedIn, async (req, res, next) => {
  try {
    res.status(201).send(
      await createReview({
        text: req.body.text,
        rating: req.body.rating,
        user_id: req.user.id,
        item_id: req.params.id,
      })
    );
  } catch (ex) {
    next(ex);
  }
});

app.put("/api/users/:userId/reviews/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.userId) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    res.send(
      await updateReview({
        user_id: req.params.userId,
        id: req.params.id,
        text: req.body.text,
        rating: req.body.rating,
      })
    );
  } catch (ex) {
    next(ex);
  }
});

app.delete("/api/users/:userId/reviews/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.userId) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    await deleteReview({ user_id: req.params.userId, id: req.params.id });
    res.sendStatus(204);
  } catch (ex) {
    next(ex);
  }
});

app.post("/api/items/:itemId/reviews/:id/comments", isLoggedIn, async (req, res, next) => {
  try {
    res.status(201).send(
      await createComment({
        text: req.body.text,
        user_id: req.user.id,
        review_id: req.params.id,
      })
    );
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/comments/me", isLoggedIn, async (req, res, next) => {
  try {
    res.send(await fetchUserComments(req.user.id));
  } catch (ex) {
    next(ex);
  }
});

app.put("/api/users/:userId/comments/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.userId) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    res.send(
      await updateComment({
        user_id: req.params.userId,
        id: req.params.id,
        text: req.body.text,
      })
    );
  } catch (ex) {
    next(ex);
  }
});

app.delete("/api/users/:userId/comments/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.userId) {
      const error = Error("not authorized");
      error.status = 401;
      throw error;
    }
    await deleteComment({ user_id: req.params.userId, id: req.params.id });
    res.sendStatus(204);
  } catch (ex) {
    next(ex);
  }
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.status || 500).send({ error: err.message ? err.message : err });
});

const init = async () => {
  const port = process.env.PORT || 3000;
  await client.connect();
  console.log("connected to database");

  await createTables();
  console.log("tables created");

  const [moe, lucy, ethyl, curly, foo, bar, bazz, quq, fip] = await Promise.all(
    [
      createUser({ username: "moe", password: "m_pw" }),
      createUser({ username: "lucy", password: "l_pw" }),
      createUser({ username: "ethyl", password: "e_pw" }),
      createUser({ username: "curly", password: "c_pw" }),
      createItem({ name: "foo", description: "foo description" }),
      createItem({ name: "bar", description: "bar description" }),
      createItem({ name: "bazz", description: "bazz description" }),
      createItem({ name: "quq", description: "quq description" }),
      createItem({ name: "fip", description: "fip description" }),
    ]
  );

  console.log(await fetchItems());

  app.listen(port, () => console.log(`listening on port ${port}`));
};

init();

