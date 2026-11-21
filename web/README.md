# COURT//INK frontend

Run from `web/` with Node 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm run build
```

Select **Try Demo** to open Tip-Off Studio at `/studio/`, then select **Run Live Demo** to open the sample chapter without FastAPI. The three presets use local fictional practice-game images and illustrative scores. The reader toolbar controls reading direction, Judge Mode, and sequential panel reveal. The source clip player appears when the storyboard includes a source clip URL.

The landing page comparison uses the frame at 1.034367 seconds from Pavel Danilyuk’s [Low Angle View of a Man Playing Basketball](https://www.pexels.com/video/low-angle-view-of-a-man-playing-basketball-5192077/), used under the [Pexels license](https://www.pexels.com/license/). FFmpeg extracted frame 31 from the 29.97 fps clip. The ink preview uses deterministic edge enhancement and halftone shading on the same frame.

## FastAPI integration

The frontend submits `POST /api/jobs` as multipart form data with `video`, `user_focus`, `target_pages`, `reading_direction`, and `enable_nano_banana`. The response can be a storyboard or a job object with `job_id` (also accepts `id`). For asynchronous jobs the frontend polls `GET /api/jobs/:id`.

Polling accepts `status`, optional `stage` (0–3 or a stage name), and optional `progress` (fraction or percentage). A completed job can return a storyboard directly or in `storyboard` or `result`. For Judge Mode include `metrics.duration_sec` and `metrics.beats_scouted`. Panel assets can be absolute URLs or root-relative `/assets/…` paths. See `src/types/manga.ts` for the storyboard contract.

Vite proxies `/api` and `/assets` to `http://127.0.0.1:8000` in development. For a split deployment set `VITE_API_BASE_URL` at build time and enable CORS on FastAPI. Production Vite bundles use `/app-assets`, leaving `/assets` available for panel media.

Unavailable API endpoints open the sample comeback chapter with a visible status message. Errors reported by a live job are shown in the studio.
