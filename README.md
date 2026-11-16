# Close the Gap · Across RCA

A small website about the climate **Awareness-to-Action Gap**: most of us care, few of us act. It explains the gap and lists friendly London climate events so people can take a first step.

It's plain HTML, CSS and JavaScript. There's no build step, nothing to install, and it's free to host on GitHub Pages.

---

## What's where

| File | What it is |
|---|---|
| `index.html` | Home page |
| `the-gap.html` | What the gap is, why it happens, how to close it |
| `first-step.html` | The 3-question quiz |
| `events.html` | Events list and map |
| `we-went.html` | Our team's reviews |
| `submit.html` | "Suggest an event" (links to the Google Form) |
| `about.html` | About the project |
| `js/config.js` | **Settings: the Google Sheet link, the form link, the map start position** |
| `css/tokens.css` | **All colours and fonts** |
| `css/style.css` | Layout and styling of everything else |
| `data/events.json` | Backup event list (used if the sheet isn't set up or doesn't load) |
| `data/events.csv` | Same events, ready to paste into Google Sheets |
| `js/data.js`, `js/events.js`, `js/quiz.js`, `js/home.js`, `js/main.js` | The code that makes it work. You shouldn't need to edit these |

---

## 1. Adding an event (no coding)

### Set up the Google Sheet (once)

1. Create a new Google Sheet.
2. Open `data/events.csv`, copy everything, and paste it into cell A1. (Or use **File → Import → Upload** in Google Sheets.)
3. **Important:** select columns C and D (`start` and `end`), then **Format → Number → Plain text**. This stops Google from changing how dates look.
4. **File → Share → Publish to web**. Choose your sheet tab and **Comma-separated values (.csv)**, then press **Publish**.
5. Copy the link it gives you. It ends in `output=csv`.
6. Open `js/config.js` and paste it between the quotes:
   ```js
   var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv";
   ```
7. Save, and upload the change to GitHub (see section 4).

From now on, **anyone who can edit the sheet can add events**. The website reads the sheet each time someone opens the page. Google can take up to about 5 minutes to update the published version.

### Add an event = add a row

| Column | What to write | Example |
|---|---|---|
| `title` | Event name | `UCL Repair Café` |
| `type` | `Talk`, `Workshop` or `Volunteering` | `Workshop` |
| `start` | Date and time: `YYYY-MM-DD HH:MM` | `2026-11-13 12:00` |
| `end` | Same format, or just a time, or leave empty | `2026-11-13 16:00` or `16:00` |
| `recurring` | Leave empty for one-off events. For regular events, write the day | `Thursdays` |
| `location_name` | Place name | `UCL East` |
| `postcode` | UK postcode (full is best) | `E20 2AE` |
| `link` | Web page for the event (starting `https://`) | |
| `note` | One short line about it | `Bring something broken!` |
| `cost` | `free`, a price like `£5`, or `unknown` | `free` |
| `beginner_friendly` | `yes`, `no` or `unknown` | `yes` |
| `solo_ok` | `yes`, `no` or `unknown` | `unknown` |
| `we_went` | `true` once one of us has been | `false` |

**Rules the site follows:**
- **Past events hide themselves** once their end time has passed. If there's no end time, they stay up until the end of that day.
- **Events on several dates:** add one row per date with the **same title and link**. The site combines them into one card ("+4 more dates").
- **Regular events** (`recurring` = `Thursdays`, `Tuesdays and Fridays`, `weekends`…) **always show**. For these, put just the times in `start` and `end`, e.g. `12:30` and `14:00`.
- **Badges** appear when the column says `yes`/`true`: "First-timer friendly", "Go solo OK", "We went".
- **Postcodes** are turned into map pins automatically using the free [postcodes.io](https://postcodes.io) service. A partial postcode like `BR3` shows a dashed circle for the approximate area.
- **Anything in `[VERIFY …]`** (like `E17 [VERIFY POSTCODE]`) shows up highlighted in yellow so we remember to check it.

If the sheet link is empty or the sheet doesn't load, the site uses `data/events.json` instead. Keep that file roughly up to date as a backup.

### The Google Form

1. Make a Google Form with questions that match the columns above.
2. In the form's **Responses** tab, link it to a spreadsheet. Suggestions then arrive in a separate tab, where someone checks them and copies good ones into the main events tab.
3. Paste the form's share link into `js/config.js`:
   ```js
   var GOOGLE_FORM_URL = "https://forms.gle/...";
   ```

---

## 2. Changing colours and fonts

Everything is in **`css/tokens.css`**.

**Colours:** change the hex codes next to each name. For example, to change the main accent:
```css
--accent: #c23b20;
```
There are three blocks: light mode, dark mode, and dark mode again (for the theme button). If you change a dark colour, change it in **both** dark blocks.

When matching the printed booklet, check that text is still easy to read. Paste your text colour and background colour into a contrast checker such as [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/) and aim for **AA**.

**Fonts:**
1. Pick fonts at [fonts.google.com](https://fonts.google.com), then click "Get embed code" and copy the `@import` line.
2. Replace the `@import` line at the top of `tokens.css`.
3. Change the names in `--font-display` (headings) and `--font-body` (everything else).

**Paper texture:** `--grain-opacity` controls the recycled-paper grain (`0` turns it off).

---

## 3. Editing text

Open any `.html` file and change the words between the tags. The header and footer are copied into every page, so **if you change the menu, change it in all 7 files**.

- **Statistics** are marked `<span class="verify">[VERIFY SOURCE]</span>`. Search the project for `VERIFY` to find them all, check each one, then delete the span (or replace it with a link to the source).
- **We went reviews:** in `we-went.html`, copy one `<article class="review">…</article>` block to add a review, and delete the dummy ones before publishing.
- **Quiz results** wording is in `js/quiz.js` under `RESULTS`.

---

## 4. Viewing it on your computer

The event list loads from a file, so the site needs a tiny local web server. Double-clicking `index.html` won't load events. In a terminal, inside this folder, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Press `Ctrl+C` to stop.

(In VS Code, the "Live Server" extension works too.)

---

## 5. Publishing on GitHub Pages (free)

1. Create a repository on GitHub and upload all these files. Keep the folder structure: `index.html` must be at the top level.
2. In the repository go to **Settings → Pages**.
3. Under **Source** choose **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

To update the site, edit files on GitHub (pencil icon) or upload new versions. It re-publishes automatically. **Adding events through the Google Sheet doesn't need GitHub at all.**

---

## Something's wrong?

- **No events showing:** open the browser console (right-click → Inspect → Console). Messages starting `[events]` explain what happened, e.g. a date in the wrong format.
- **An event is missing from the map:** check its postcode. Messages starting `[map]` name the postcode that wasn't found.
- **Sheet changes not showing:** wait a few minutes (Google's publish delay), then refresh.

Credits: map © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, via [Leaflet](https://leafletjs.com). Postcode lookups by [postcodes.io](https://postcodes.io).
