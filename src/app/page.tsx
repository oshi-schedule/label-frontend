"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Pencil, Send, Trash2, UploadCloud } from "lucide-react";

type SourceType = "timetable" | "flyer" | "meet_and_greet";
type UploadStep = "editing" | "done";

type UploadResponse = {
  job_id: string;
  job_ids: string[];
  status: "queued" | string;
  accepted_files: number;
  chunk_size: number;
};

const CONTRIBUTOR_STORAGE_KEY = "contributor_name";
const TOKEN_STORAGE_KEY = "contributor_token";

const sourceOptions: Array<{ value: SourceType; label: string; note: string }> = [
  { value: "timetable", label: "タイムテーブル", note: "出演時間やステージ表" },
  { value: "flyer", label: "フライヤー", note: "告知画像やイベント概要" },
  { value: "meet_and_greet", label: "特典会", note: "物販・特典会の案内" }
];

function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

function mergeFiles(current: File[], selected: File[]) {
  const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const next = [...current];
  selected.forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      next.push(file);
    }
  });
  return next;
}

export default function LabelUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("timetable");
  const [files, setFiles] = useState<File[]>([]);
  const [contributorName, setContributorName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<UploadStep>("editing");
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedName = window.localStorage.getItem(CONTRIBUTOR_STORAGE_KEY) ?? "";
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
    setContributorName(storedName);
    setDraftName(storedName);
    setIsEditingName(!storedName);
  }, []);

  const previewFiles = useMemo(() => files.slice(0, 4), [files]);
  const canUpload = contributorName.trim().length > 0 && files.length > 0 && !isUploading;

  function saveContributorName() {
    const nextName = draftName.trim();
    if (!nextName) {
      setError("ニックネームを入力してください。");
      return;
    }
    window.localStorage.setItem(CONTRIBUTOR_STORAGE_KEY, nextName);
    setContributorName(nextName);
    setDraftName(nextName);
    setIsEditingName(false);
    setError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    setFiles((current) => mergeFiles(current, selected));
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
      formData.set("contributor_name", contributorName.trim());
      formData.set("source_type_hint", sourceType);
      const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        formData.set("contributor_token", token);
      }
      files.forEach((file) => formData.append("images", file));

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
      setAcceptedCount(body.accepted_files || files.length);
      setFiles([]);
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
          <h1>タイテ画像収集</h1>
          <p className="lead">画像を選んでアップロードするだけで完了です。</p>
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
              <h2>投稿者</h2>
              {!isEditingName && (
                <button
                  className="icon-text-button"
                  type="button"
                  onClick={() => {
                    setDraftName(contributorName);
                    setIsEditingName(true);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  変更
                </button>
              )}
            </div>

            {isEditingName ? (
              <div className="name-editor">
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="ニックネーム"
                  maxLength={80}
                  autoComplete="nickname"
                />
                <button className="save-button" type="button" onClick={saveContributorName}>
                  保存
                </button>
              </div>
            ) : (
              <p className="contributor-name">{contributorName}</p>
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
              {files.length > 0 && (
                <button className="icon-button" type="button" onClick={() => setFiles([])} aria-label="選択をクリア">
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
            />

            <button className="file-picker" type="button" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud aria-hidden="true" />
              画像を選ぶ
            </button>

            <div className="selected-summary">
              <span>選択済み</span>
              <strong>{files.length}枚</strong>
            </div>

            {previewFiles.length > 0 && (
              <div className="file-list" aria-label="選択中の画像">
                {previewFiles.map((file) => (
                  <div className="file-row" key={`${file.name}:${file.size}:${file.lastModified}`}>
                    <span>{file.name}</span>
                    <small>{Math.max(1, Math.round(file.size / 1024))}KB</small>
                  </div>
                ))}
                {files.length > previewFiles.length && <p className="more-count">ほか {files.length - previewFiles.length}枚</p>}
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

