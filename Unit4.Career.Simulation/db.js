// src/db.js
const pg = require("pg");
const uuid = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const client = new pg.Client(
  process.env.DATABASE_URL || "postgres://localhost/Unit4_Sim"
);

const JWT_SECRET = process.env.JWT_SECRET || "shhh";
if (JWT_SECRET === "shhh") {
  console.log("If deployed, set process.env.JWT_SECRET to something other than shhh");
}

const createTables = async () => {
  const SQL = `--sql
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS items;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users(
      id UUID PRIMARY KEY,
      username VARCHAR(20) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    );

    CREATE TABLE items(
      id UUID PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      averageRating FLOAT
    );

    CREATE TABLE reviews(
      id UUID PRIMARY KEY,
      text TEXT NOT NULL,
      rating FLOAT NOT NULL,
      user_id UUID REFERENCES users(id) NOT NULL,
      item_id UUID REFERENCES items(id) NOT NULL,
      CONSTRAINT unique_user_id_and_item_id UNIQUE (user_id, item_id)
    );

    CREATE TABLE comments(
      id UUID PRIMARY KEY,
      text TEXT NOT NULL,
      user_id UUID REFERENCES users(id) NOT NULL,
      review_id UUID REFERENCES reviews(id) NOT NULL
    );
  `;
  await client.query(SQL);
};

const createUser = async ({ username, password }) => {
  const SQL = `--sql
    INSERT INTO users(id, username, password) VALUES($1, $2, $3) RETURNING *
  `;
  const response = await client.query(SQL, [
    uuid.v4(),
    username,
    await bcrypt.hash(password, 5),
  ]);
  return response.rows[0];
};

const createUserAndGenerateToken = async ({ username, password }) => {
  const user = await createUser({ username, password });
  const token = await jwt.sign({ id: user.id }, JWT_SECRET);
  return { token };
};

const createItem = async ({ name, description }) => {
  const SQL = `--sql
    INSERT INTO items(id, name, description) VALUES($1, $2, $3) RETURNING *
  `;
  const response = await client.query(SQL, [uuid.v4(), name, description]);
  return response.rows[0];
};

const createReview = async ({ text, rating, user_id, item_id }) => {
  const SQL = `--sql
    INSERT INTO reviews(id, text, rating, user_id, item_id) VALUES($1, $2, $3, $4, $5) RETURNING *
  `;
  const response = await client.query(SQL, [uuid.v4(), text, rating, user_id, item_id]);
  return response.rows[0];
};

const createComment = async ({ text, user_id, review_id }) => {
  const SQL = `--sql
    INSERT INTO comments(id, text, user_id, review_id) VALUES($1, $2, $3, $4) RETURNING *
  `;
  const response = await client.query(SQL, [uuid.v4(), text, user_id, review_id]);
  return response.rows[0];
};

const authenticate = async ({ username, password }) => {
  const SQL = `--sql
    SELECT id, username, password FROM users WHERE username=$1;
  `;
  const response = await client.query(SQL, [username]);
  if (
    !response.rows.length ||
    (await bcrypt.compare(password, response.rows[0].password)) === false
  ) {
    const error = Error("not authorized");
    error.status = 401;
    throw error;
  }
  const token = await jwt.sign({ id: response.rows[0].id }, JWT_SECRET);
  return { token };
};

const findUserWithToken = async (token) => {
  let id;
  try {
    const payload = await jwt.verify(token, JWT_SECRET);
    id = payload.id;
  } catch (ex) {
    const error = Error("not authorized");
    error.status = 401;
    throw error;
  }
  const SQL = `--sql
    SELECT id, username FROM users WHERE id=$1;
  `;
  const response = await client.query(SQL, [id]);
  if (!response.rows.length) {
    const error = Error("not authorized");
    error.status = 401;
    throw error;
  }
  return response.rows[0];
};

const fetchItems = async (search) => {
  const SQL = search ? `--sql
    SELECT * FROM items WHERE name ILIKE $1 OR description ILIKE $1;
  ` : `--sql
    SELECT * FROM items;
  `;
  const params = search ? [`%${search}%`] : [];
  const response = await client.query(SQL, params);
  return response.rows;
};

const fetchItemDetails = async (id) => {
  const SQL = `--sql
    SELECT i.*, AVG(r.rating) as averageRating
    FROM items i
    LEFT JOIN reviews r ON i.id = r.item_id
    WHERE i.id = $1
    GROUP BY i.id;
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0];
};

const fetchReviews = async (item_id) => {
  const SQL = `--sql
    SELECT * FROM reviews WHERE item_id = $1;
  `;
  const response = await client.query(SQL, [item_id]);
  return response.rows;
};

const fetchUserComments = async (user_id) => {
  const SQL = `--sql
    SELECT * FROM comments WHERE user_id = $1;
  `;
  const response = await client.query(SQL, [user_id]);
  return response.rows;
};

const deleteReview = async ({ user_id, id }) => {
  const SQL = `--sql
    DELETE FROM reviews WHERE user_id=$1 AND id=$2;
  `;
  await client.query(SQL, [user_id, id]);
};

const deleteComment = async ({ user_id, id }) => {
  const SQL = `--sql
    DELETE FROM comments WHERE user_id=$1 AND id=$2;
  `;
  await client.query(SQL, [user_id, id]);
};

const updateReview = async ({ user_id, id, text, rating }) => {
  const SQL = `--sql
    UPDATE reviews SET text=$1, rating=$2 WHERE user_id=$3 AND id=$4 RETURNING *
  `;
  const response = await client.query(SQL, [text, rating, user_id, id]);
  return response.rows[0];
};

const updateComment = async ({ user_id, id, text }) => {
  const SQL = `--sql
    UPDATE comments SET text=$1 WHERE user_id=$2 AND id=$3 RETURNING *
  `;
  const response = await client.query(SQL, [text, user_id, id]);
  return response.rows[0];
};

module.exports = {
  client,
  createTables,
  createUser,
  createItem,
  fetchItems,
  fetchItemDetails,
  fetchReviews,
  fetchUserComments,
  createReview,
  createComment,
  deleteReview,
  deleteComment,
  updateReview,
  updateComment,
  authenticate,
  findUserWithToken,
  createUserAndGenerateToken,
};
