const mysql = require('mysql');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const express = require('express');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/auth/register', (req, res) => {
    const { error } = validateUser(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    (async () => {
        const email = req.body.email;
        let query = `SELECT * FROM users WHERE email='${email}'`;
        let result = await executeQuery(query);
        if (result.length > 0) {
            res.send('This email is already in use.');
        }
        else {
            (async () => {
                const name = req.body.name;
                const password = req.body.password;
                const values = [name, password, email];
                query = `INSERT INTO users (name, password, email) VALUES (?, AES_ENCRYPT(?, 'C1WvGUkW5i'),?)`;
                result = await executeQuery(query, values);
                console.log(result);
                if (result.affectedRows === 1) {
                    res.send(true);
                }
                else {
                    res.send(false);
                }
            })();
        }
    })();
});

app.post('/auth/login', (req, res) => {
    (async () => {
        const email = req.body.email;
        const password = req.body.password;
        const values = [email, password];
        const query = `SELECT * FROM users WHERE email=? AND AES_DECRYPT(password, 'C1WvGUkW5i')=?`;
        const result = await executeQuery(query, values);
        if (result.length > 0) {
            console.log(result);
            jwt.sign({ user: result }, 'secretkey', { expiresIn: '24h' }, (error, token) => {
                res.json({
                    token
                });
            });
        }
        else {
            res.status(404).send('This user is not registered.');
        }
    })();
});

app.get('/books', (req, res) => {
    (async () => {
        const query = 'SELECT title, isbn, author, release_date, name, email FROM books LEFT JOIN users ON books.users_id=users.id';
        const result = await executeQuery(query);
        console.log(result);
        if (result.length > 0) {
            res.send(result);
        }
        else {
            res.send('There are no registered books.');
        }
    })();
});

app.get('/books/:id', (req, res) => {
    (async () => {
        const id = req.params.id;
        const query = `SELECT * FROM books WHERE id=${id}`;
        const result = await executeQuery(query);
        console.log(result);
        if (result.length > 0) {
            res.send(result);
        }
        else {
            res.status(404).send(false);
        }
    })();
});


app.post('/books', verifyToken, (req, res) => {
    const { error } = validatePostBook(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    (async () => {
        const isbn = req.body.isbn;
        let query = `SELECT * FROM books WHERE isbn='${isbn}'`;
        let result = await executeQuery(query);
        if (result.length > 0) {
            res.send('This book is already registered.');
        }
        else {
            (async () => {
                jwt.verify(req.token, 'secretkey', (error, authData) => {
                    if (error) {
                        res.sendStatus(403);
                    }
                    else {
                        const users_id = parseInt(authData.user[0].id);
                        (async () => {
                            const title = req.body.title;
                            const author = req.body.author;
                            const release_date = req.body.release_date;
                            const values = [title, isbn, author, release_date, users_id];
                            query = 'INSERT INTO books (title, isbn, author, release_date, users_id) VALUES (?,?,?,?,?)';
                            result = await executeQuery(query, values);
                            console.log(result);
                            if (result.affectedRows === 1) {
                                res.send(result.insertId.toString());
                            }
                            else {
                                res.send(false);
                            }
                        })();
                    }
                });
            })();
        }
    })();
});

app.put('/books/:id', (req, res) => {
    const { error } = validatePutBook(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    (async () => {
        const isbn = req.body.isbn;
        let query = `SELECT * FROM books WHERE isbn='${isbn}'`;
        let result = await executeQuery(query);
        if (result.length > 0) {
            res.send('This book is already registered.');
        }
        else {
            (async () => {
                const id = req.params.id;
                const title = req.body.title;
                const author = req.body.author;
                const release_date = req.body.release_date;
                let columns = [];
                let values = [];
                if (typeof title !== 'undefined') {
                    columns.push('title=?');
                    values.push(title);
                }
                if (typeof isbn !== 'undefined') {
                    columns.push('isbn=?');
                    values.push(isbn);
                }
                if (typeof author !== 'undefined') {
                    columns.push('author=?');
                    values.push(author);
                }
                if (typeof release_date !== 'undefined') {
                    columns.push('release_date=?');
                    values.push(release_date);
                }
                const columnsString = columns.join();
                query = `UPDATE books SET ${columnsString} WHERE id=${id}`;
                result = await executeQuery(query, values);
                console.log(result);
                if (result.affectedRows === 1) {
                    res.send(true);
                }
                else {
                    res.status(404).send(false);
                }
            })();
        }
    })();
});

app.delete('/books/:id', verifyToken, (req, res) => {
    jwt.verify(req.token, 'secretkey', (error, authData) => {
        if (error) {
            res.sendStatus(403);
        }
        else {
            (async () => {
                const id = req.params.id;
                const query = `DELETE FROM books WHERE id=${id}`;
                const result = await executeQuery(query);
                console.log(result);
                if (result.affectedRows === 1) {
                    res.send(true);
                }
                else {
                    res.status(404).send(false);
                }
            })();
        }
    });
});

function executeQuery(query, values = false) {
    const connection = mysql.createConnection({
        host: 'localhost',
        database: 'libreria',
        user: 'root',
        password: ''
    });
    connection.connect();
    return new Promise((resolve, reject) => {
        if (!values) {
            connection.query(query, (error, result) => {
                connection.end();
                return error ? reject(error) : resolve(result);
            });
        }
        else {
            connection.query(query, values, (error, result) => {
                connection.end();
                return error ? reject(error) : resolve(result);
            });
        }
    });
}

function validateUser(user) {
    const schema = Joi.object({
        name: Joi.string().max(255).required(),
        password: Joi.string().max(255).required(),
        email: Joi.string().max(255).required().email()
    });
    return schema.validate(user);
}

function validatePostBook(book) {
    const schema = Joi.object({
        title: Joi.string().max(500).required(),
        isbn: Joi.string().max(255).required(),
        author: Joi.string().max(255).required(),
        release_date: Joi.date().iso().required()
    });
    return schema.validate(book);
}

function validatePutBook(book) {
    const schema = Joi.object({
        title: Joi.string().max(500),
        isbn: Joi.string().max(255),
        author: Joi.string().max(255),
        release_date: Joi.date().iso()
    });
    return schema.validate(book);
}

function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(" ")[1];
        req.token = bearerToken;
        next();
    }
    else {
        res.sendStatus(403);
    }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));