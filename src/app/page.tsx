"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Pencil, Send, Trash2, UploadCloud } from "lucide-react";

type SourceType = "schedule_document" | "flyer" | "x_post" | "other";
type UploadStep = "editing" | "done";

type UploadResponse = {
  job_id: string;
  job_ids: string[];
  status: "queued" | string;
  accepted_files: number;
  chunk_size: number;
};

const TOKEN_STORAGE_KEY = "contributor_token";

const sourceOptions: Array<{ value: SourceType; label: string; note: string }> = [
  { value: "schedule_document", label: "タイムテーブル", note: "出演・特典会・物販などの時間表" },
  { value: "flyer", label: "告知画像", note: "イベント概要や出演者一覧" },
  { value: "x_post", label: "X投稿のスクショ", note: "Xの投稿画面を撮影した画像" },
  { value: "other", label: "その他", note: "上のどれにも当てはまらない画像" },
];

function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export default function LabelUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("schedule_document");
  const [file, setFile] = useState<File | null>(null);
  const [contributorToken, setContributorToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<UploadStep>("editing");
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("token")?.trim();
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
    const token = queryToken || storedToken;
    if (queryToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, queryToken);
    }
    setContributorToken(token);
    setDraftToken(token);
    setIsEditingToken(!token);
  }, []);

  const canUpload = contributorToken.trim().length > 0 && file !== null && !isUploading;

  function saveContributorToken() {
    const nextToken = draftToken.trim();
    if (!nextToken) {
      setError("認証キーを入力してください。");
      return;
    }
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setContributorToken(nextToken);
    setDraftToken(nextToken);
    setIsEditingToken(false);
    setError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).find((nextFile) => nextFile.type.startsWith("image/"));
    setFile(selected ?? null);
    setError(null);
    event.target.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpload) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("source_type_hint", sourceType);
      formData.set("contributor_token", contributorToken.trim());
      if (file) {
        formData.append("images", file);
      }

      const response = await fetch(`${resolveApiBaseUrl()}/public/training-dataset/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let detail = "アップロードに失敗しました。";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string") detail = body.detail;
        } catch {
          detail = `アップロードに失敗しました。HTTP ${response.status}`;
        }
        throw new Error(detail);
      }

      const body = (await response.json()) as UploadResponse;
      setAcceptedCount(body.accepted_files || 1);
      setFile(null);
      setStep("done");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "アップロードに失敗しました。");
    } finally {
      setIsUploading(false);
    }
  }

  function resetForMoreImages() {
    setAcceptedCount(0);
    setError(null);
    setStep("editing");
  }

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="hero-inner">
          <p className="eyebrow">Event Candidate Labeling</p>
          <h1>画像アップロード</h1>
          <p className="lead">タイムテーブル、告知画像、Xのスクショなどを1枚ずつ送れます。</p>
        </div>
      </section>

      {step === "done" ? (
        <section className="done-panel" aria-live="polite">
          <CheckCircle2 className="done-icon" aria-hidden="true" />
          <h2>アップロード完了</h2>
          <p>{acceptedCount}枚を受け付けました。</p>
          <p className="thanks">ご協力ありがとうございます！</p>
          <button className="primary-button" type="button" onClick={resetForMoreImages}>
            <ImagePlus aria-hidden="true" />
            さらに画像を追加
          </button>
        </section>
      ) : (
        <form className="upload-panel" onSubmit={handleSubmit}>
          <section className="form-section contributor-section">
            <div className="section-title-row">
              <h2>認証キー</h2>
              {!isEditingToken && (
                <button
                  className="icon-text-button"
                  type="button"
                  onClick={() => {
                    setDraftToken(contributorToken);
                    setIsEditingToken(true);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  変更
                </button>
              )}
            </div>

            {isEditingToken ? (
              <div className="name-editor">
                <input
                  value={draftToken}
                  onChange={(event) => setDraftToken(event.target.value)}
                  placeholder="認証キー"
                  maxLength={200}
                  autoComplete="off"
                  inputMode="text"
                  type="password"
                />
                <button className="save-button" type="button" onClick={saveContributorToken}>
                  保存
                </button>
              </div>
            ) : (
              <p className="contributor-name">保存済み（末尾 {contributorToken.slice(-6)}）</p>
            )}
          </section>

          <section className="form-section">
            <h2>種別選択</h2>
            <div className="segmented-list" role="radiogroup" aria-label="画像種別">
              {sourceOptions.map((option) => (
                <button
                  className={`source-option ${sourceType === option.value ? "selected" : ""}`}
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={sourceType === option.value}
                  onClick={() => setSourceType(option.value)}
                >
                  <span className="radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.note}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-title-row">
              <h2>画像追加</h2>
              {file && (
                <button className="icon-button" type="button" onClick={() => setFile(null)} aria-label="選択をクリア">
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />

            <button className="file-picker" type="button" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud aria-hidden="true" />
              画像を選ぶ
            </button>

            <div className="selected-summary">
              <span>選択済み</span>
              <strong>{file ? "1枚" : "なし"}</strong>
            </div>

            {file && (
              <div className="file-list" aria-label="選択中の画像">
                <div className="file-row">
                  <span>{file.name}</span>
                  <small>{Math.max(1, Math.round(file.size / 1024))}KB</small>
                </div>
              </div>
            )}
          </section>

          {error && <p className="error-message">{error}</p>}

          <button className="primary-button submit-button" type="submit" disabled={!canUpload}>
            {isUploading ? <Loader2 className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {isUploading ? "アップロード中" : "アップロード"}
          </button>
        </form>
      )}
    </main>
  );
}
