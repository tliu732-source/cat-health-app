"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "@/lib/supabase";
import {
  MAX_CAT_IMAGE_BYTES,
  uploadCatImage,
  validateCatImageFile,
} from "@/lib/cat-image";

type Cat = {
  id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  image_url: string | null;
};

type CatRow = {
  id: string;
  name: string;
  breed: string;
  age: number | null;
  weight: number | null;
  image_url: string | null;
};

const emptyForm = { name: "", breed: "", age: "", weight: "" };

type FormFields = typeof emptyForm;

const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20";

const fileInputClass =
  "mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700";

const labelClass = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const ghostBtnClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

const dangerBtnClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30";

function rowToCat(row: CatRow): Cat {
  const raw = row.image_url;
  const image_url =
    raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
  return {
    id: row.id,
    name: row.name,
    breed: row.breed || "未填",
    age: Number(row.age ?? 0),
    weight: Number(row.weight ?? 0),
    image_url,
  };
}

/** 表单年龄字符串 → 非负数字，保留小数，不做取整。 */
function ageFromFormValue(value: string): number {
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function formatAgeDisplay(age: number): string {
  if (!Number.isFinite(age)) return "0";
  return age.toLocaleString("zh-CN", {
    maximumFractionDigits: 10,
    minimumFractionDigits: 0,
    useGrouping: false,
  });
}

function CatAvatar({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 动态 Supabase 公开 URL
      <img
        src={imageUrl}
        alt={`${name} 的照片`}
        className="h-16 w-16 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
      />
    );
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-100 text-[10px] leading-tight text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      aria-hidden
    >
      <span className="text-lg" aria-hidden>
        🐱
      </span>
      <span>暂无照片</span>
    </div>
  );
}

export default function Home() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(emptyForm);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPreviewUrl = useMemo(() => {
    if (!addImageFile) return null;
    return URL.createObjectURL(addImageFile);
  }, [addImageFile]);

  useEffect(() => {
    return () => {
      if (addPreviewUrl) URL.revokeObjectURL(addPreviewUrl);
    };
  }, [addPreviewUrl]);

  const loadCats = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("cats")
      .select("id, name, breed, age, weight, image_url")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(`加载失败：${fetchError.message}`);
      setCats([]);
      return;
    }

    setCats((data as CatRow[] | null)?.map(rowToCat) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadCats();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCats]);

  function clearAddImage() {
    setAddImageFile(null);
    if (addFileInputRef.current) addFileInputRef.current.value = "";
  }

  function onAddImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) {
      setAddImageFile(null);
      return;
    }
    const msg = validateCatImageFile(f);
    if (msg) {
      setError(msg);
      e.target.value = "";
      setAddImageFile(null);
      return;
    }
    setAddImageFile(f);
  }

  function onEditImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) {
      setEditImageFile(null);
      return;
    }
    const msg = validateCatImageFile(f);
    if (msg) {
      setError(msg);
      e.target.value = "";
      setEditImageFile(null);
      return;
    }
    setEditImageFile(f);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = form.name.trim();
    const breed = form.breed.trim();
    if (!name) return;

    const age = ageFromFormValue(form.age);
    const weightNum = Number(form.weight);
    const weight = Number.isFinite(weightNum) ? Math.max(0, weightNum) : 0;

    if (addImageFile) {
      const again = validateCatImageFile(addImageFile);
      if (again) {
        setError(again);
        return;
      }
    }

    setBusy(true);
    setError(null);

    let image_url: string | null = null;
    if (addImageFile) {
      const up = await uploadCatImage(addImageFile, "uploads");
      if ("error" in up) {
        setError(`图片上传失败：${up.error}`);
        setBusy(false);
        return;
      }
      image_url = up.url;
    }

    const { data, error: insertError } = await supabase
      .from("cats")
      .insert({
        name,
        breed: breed || "未填",
        age,
        weight,
        image_url,
      })
      .select("id, name, breed, age, weight, image_url")
      .single();

    setBusy(false);

    if (insertError) {
      setError(`添加失败：${insertError.message}`);
      return;
    }

    if (data) {
      setCats((prev) => [...prev, rowToCat(data as CatRow)]);
    }
    setForm(emptyForm);
    clearAddImage();
  }

  function startEdit(cat: Cat) {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      breed: cat.breed === "未填" ? "" : cat.breed,
      age: String(cat.age),
      weight: cat.weight === 0 ? "" : String(cat.weight),
    });
    setEditImageFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
    setEditImageFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    const name = editForm.name.trim();
    const breed = editForm.breed.trim();
    if (!name) return;

    const age = ageFromFormValue(editForm.age);
    const weightNum = Number(editForm.weight);
    const weight = Number.isFinite(weightNum) ? Math.max(0, weightNum) : 0;

    const existing = cats.find((c) => c.id === editingId)?.image_url ?? null;

    if (editImageFile) {
      const again = validateCatImageFile(editImageFile);
      if (again) {
        setError(again);
        return;
      }
    }

    setBusy(true);
    setError(null);

    let image_url: string | null = existing;
    if (editImageFile) {
      const up = await uploadCatImage(editImageFile, `cats/${editingId}`);
      if ("error" in up) {
        setError(`图片上传失败：${up.error}`);
        setBusy(false);
        return;
      }
      image_url = up.url;
    }

    const { data, error: updateError } = await supabase
      .from("cats")
      .update({
        name,
        breed: breed || "未填",
        age,
        weight,
        image_url,
      })
      .eq("id", editingId)
      .select("id, name, breed, age, weight, image_url")
      .single();

    setBusy(false);

    if (updateError) {
      setError(`保存失败：${updateError.message}`);
      return;
    }

    if (data) {
      const updated = rowToCat(data as CatRow);
      setCats((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
    }
    cancelEdit();
  }

  async function removeCat(id: string) {
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase.from("cats").delete().eq("id", id);
    setBusy(false);

    if (deleteError) {
      setError(`删除失败：${deleteError.message}`);
      return;
    }

    setCats((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) cancelEdit();
  }

  function formatWeight(w: number) {
    return w % 1 === 0 ? String(w) : w.toFixed(1);
  }

  const mbMax = MAX_CAT_IMAGE_BYTES / (1024 * 1024);

  return (
    <div className="min-h-full flex flex-col bg-[#f7f7f5] dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 border-b border-zinc-200/80 pb-6 dark:border-zinc-800">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            猫咪档案
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {loading ? "加载中…" : `共 ${cats.length} 只`}
          </p>
        </header>

        {error ? (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <section className="mb-8 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            新建档案
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            数据保存在 Supabase；可选上传头像至存储桶「cat-images」。填好点「添加猫咪」，修改请在下栏「编辑」后「保存」。
          </p>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="cat-name" className={labelClass}>
                名字
              </label>
              <input
                id="cat-name"
                name="name"
                type="text"
                required
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                placeholder="例如：豆豆"
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cat-breed" className={labelClass}>
                品种
              </label>
              <input
                id="cat-breed"
                name="breed"
                type="text"
                value={form.breed}
                onChange={(e) =>
                  setForm((f) => ({ ...f, breed: e.target.value }))
                }
                className={inputClass}
                placeholder="例如：英短、美短"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="cat-age" className={labelClass}>
                年龄
              </label>
              <input
                id="cat-age"
                name="age"
                type="number"
                min={0}
                step="any"
                value={form.age}
                onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                className={inputClass}
                placeholder="岁，可填小数，如 2.5"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="cat-weight" className={labelClass}>
                体重
              </label>
              <input
                id="cat-weight"
                name="weight"
                type="number"
                min={0}
                step={0.1}
                value={form.weight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight: e.target.value }))
                }
                className={inputClass}
                placeholder="公斤"
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cat-photo" className={labelClass}>
                头像（选填）
              </label>
              <input
                ref={addFileInputRef}
                id="cat-photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={onAddImagePicked}
                className={fileInputClass}
                disabled={busy}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                支持 JPG、PNG、WebP，单张不超过 {mbMax}MB。
              </p>
              {addPreviewUrl ? (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={addPreviewUrl}
                    alt="预览"
                    className="h-14 w-14 rounded-lg border border-zinc-200 object-cover dark:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={clearAddImage}
                    disabled={busy}
                    className={ghostBtnClass}
                  >
                    移除图片
                  </button>
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy || loading}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {busy ? "提交中…" : "添加猫咪"}
              </button>
            </div>
          </form>
        </section>

        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            全部猫咪
          </h2>
        </div>
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {loading ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              加载中…
            </li>
          ) : null}
          {!loading && cats.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              暂无记录，先在上方添加一只猫咪吧。
            </li>
          ) : null}
          {!loading
            ? cats.map((cat) => {
                const isEditing = editingId === cat.id;
                return (
                  <li key={cat.id} className="px-4 py-4 sm:px-5">
                    {isEditing ? (
                      <form onSubmit={saveEdit} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2 flex gap-4">
                            <CatAvatar imageUrl={cat.image_url} name={cat.name} />
                            <p className="flex-1 self-center text-xs text-zinc-500 dark:text-zinc-400">
                              更换头像请重新选择图片；不选则保留当前照片。
                            </p>
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass} htmlFor={`edit-name-${cat.id}`}>
                              名字
                            </label>
                            <input
                              id={`edit-name-${cat.id}`}
                              required
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, name: e.target.value }))
                              }
                              className={inputClass}
                              disabled={busy}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass} htmlFor={`edit-breed-${cat.id}`}>
                              品种
                            </label>
                            <input
                              id={`edit-breed-${cat.id}`}
                              value={editForm.breed}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, breed: e.target.value }))
                              }
                              className={inputClass}
                              disabled={busy}
                            />
                          </div>
                          <div>
                            <label className={labelClass} htmlFor={`edit-age-${cat.id}`}>
                              年龄
                            </label>
                            <input
                              id={`edit-age-${cat.id}`}
                              type="number"
                              min={0}
                              step="any"
                              value={editForm.age}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, age: e.target.value }))
                              }
                              className={inputClass}
                              placeholder="如 2.5"
                              disabled={busy}
                            />
                          </div>
                          <div>
                            <label className={labelClass} htmlFor={`edit-weight-${cat.id}`}>
                              体重
                            </label>
                            <input
                              id={`edit-weight-${cat.id}`}
                              type="number"
                              min={0}
                              step={0.1}
                              value={editForm.weight}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, weight: e.target.value }))
                              }
                              className={inputClass}
                              disabled={busy}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass} htmlFor={`edit-photo-${cat.id}`}>
                              新头像（选填）
                            </label>
                            <input
                              ref={editFileInputRef}
                              id={`edit-photo-${cat.id}`}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                              onChange={onEditImagePicked}
                              className={fileInputClass}
                              disabled={busy}
                            />
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              JPG / PNG / WebP，最大 {mbMax}MB。
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            {busy ? "保存中…" : "保存"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={busy}
                            className={ghostBtnClass}
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 gap-4">
                          <CatAvatar imageUrl={cat.image_url} name={cat.name} />
                          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 sm:gap-4">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                                {cat.name}
                              </p>
                              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                                {cat.breed}
                              </p>
                            </div>
                            <dl className="grid grid-cols-2 gap-2 text-sm sm:text-right">
                              <div>
                                <dt className="text-zinc-500 dark:text-zinc-400">年龄</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {formatAgeDisplay(cat.age)} 岁
                                </dd>
                              </div>
                              <div>
                                <dt className="text-zinc-500 dark:text-zinc-400">体重</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {formatWeight(cat.weight)} 公斤
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2 sm:justify-start">
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            disabled={busy}
                            className={ghostBtnClass}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCat(cat.id)}
                            disabled={busy}
                            className={dangerBtnClass}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })
            : null}
        </ul>
      </main>
    </div>
  );
}
