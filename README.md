# Event Candidate Labeling Frontend

Public mobile-first upload screen for collecting timetable, flyer, meet-and-greet, and X screenshot images one at a time.

## Setup

```bash
cd label-frontend
npm install
cp .env.example .env.local
npm run dev
```

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

The app posts selected images to `POST /public/training-dataset/upload`.
