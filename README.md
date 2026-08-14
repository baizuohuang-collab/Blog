# Full-Stack Personal Journal (Blog)

This project has been updated from a static HTML page to a full-stack personal journal backed by a Node.js Express server and a SQLite database.

## Architecture & How the API Works

We built a self-contained local backend API server:
1. **Server (`server.js`)**: A Node.js backend using **Express** that runs on `http://localhost:3000`.
2. **Database (`database.db`)**: A lightweight, file-based **SQLite** database that stores all your blog posts locally in your project folder.
3. **API Routing**:
   - `GET /api/posts` - Fetches all blog posts.
   - `POST /api/posts` - Adds a new blog post.
   - `PUT /api/posts/:id` - Edits an existing blog post.
   - `DELETE /api/posts/:id` - Deletes a blog post.
4. **Proxy & Fallback**:
   - If you run the server and access `http://localhost:3000`, the server acts as the host and communicates directly using relative API paths (`/api/posts`).
   - If you open the `index.html` file directly using `file://` (double-clicking the HTML file), the frontend is programmed to fetch from `http://localhost:3000/api/posts`.
   - If the backend server is **offline**, the frontend automatically falls back to browser `localStorage`, ensuring your blog remains fully functional in offline mode!

*Note: The weather forecast uses the free Open-Meteo API which requires no API keys and is fetched directly by the browser.*

## Quick Start (How to Run Locally)

To start the API server and database locally:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   *The console should print: `Server is running at http://localhost:3000` and `Connected to the SQLite database.`*

3. **Open the website**:
   Open your browser and visit: [http://localhost:3000](http://localhost:3000)

## Features Included

- **Full SQLite CRUD**: Add, edit, and delete posts persistently.
- **Markdown Editor**: Write with rich markdown formatting (rendered using `marked.js`).
- **Interactive Weather widget**: Interactive canvas chart displaying 24h temp curve with geocoding city search.
- **Dark/Light Mode**: High-fidelity dark mode with local preference storage.
- **Search & Tag Filtering**: Instantly search posts or filter by clicking tag badges.
- **Draft Auto-save**: Auto-saves your editor text locally to prevent loss of work on reload.
