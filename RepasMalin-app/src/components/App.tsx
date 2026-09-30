"use client";
import { useEffect, useState } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { allRecipes, store, CUSTOM_KEY, SOURCES, type Recipe, type Src } from "@/lib/recipes";
import AddRecipe from "./AddRecipe";
import { generateWeek, replaceIds, targetWeek } from "@/lib/generate";
import { buildShoppingList } from "@/lib/shopping";

type State = { week: string; sources: Src[]; ids: string[]; validated: boolean; rejected: string[]; checked: string[] };
type Tab = "selection" | "calendrier" | "courses";
const KEY = "repasmalin.v1";
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const byId = (id: string) => allRecipes().find((r) => r.id === id)!;
const badge = (s: Src) => (s === "COOKOMIX" ? "bg-orange-100 text-orange-800" : "bg-sky-100 text-sky-800");
const fresh = (sources: Src[]): State => ({ week: targetWeek(), sources, ids: generateWeek(sources), validated: false, rejected: [], checked: [] });

function DayCard({ recipe, day, onOpen }: { recipe: Recipe; day: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: recipe.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`touch-none rounded-xl border bg-white p-3 shadow-sm ${isDragging ? "z-10 ring-2 ring-emerald-500" : ""}`} {...attributes} {...listeners}>
      <p className="text-xs font-bold uppercase text-emerald-700">{day}</p>
      <p className="mt-1 font-medium leading-tight">{recipe.title}</p>
      <span className={`mt-2 inline-block rounded px-1.5 text-xs ${badge(recipe.source)}`}>{recipe.source === "COOKOMIX" ? "Thermomix" : "Classique"}</span>
      <button onPointerDown={(e) => e.stopPropagation()} onClick={onOpen} className="ml-2 text-xs underline">fiche</button>
    </div>
  );
}

function RecipeModal({ r, onClose }: { r: Recipe; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <article className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between gap-4"><h2 className="text-xl font-bold">{r.title}</h2><button onClick={onClose} aria-label="Fermer">✕</button></div>
        <p className="mt-1 text-sm text-stone-600">{r.source === "COOKOMIX" ? "Cookomix" : "Kookmutjes"} · Préparation {r.prep} min · Cuisson {r.cook} min · {r.servings} portions</p>
        <h3 className="mt-4 font-semibold">Ingrédients</h3>
        <ul className="list-disc pl-5 text-sm">{r.ing.map(([n, q, u], i) => <li key={i}>{q ?? ""} {u ?? ""} {n}</li>)}</ul>
        <h3 className="mt-4 font-semibold">Préparation</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </article>
    </div>
  );
}

export default function App() {
  const [s, setS] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("selection");
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [adding, setAdding] = useState(false);
  const [, refresh] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));

  useEffect(() => {
    try { store.custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); } catch {}
    let st: State | null = null;
    try { st = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
    // Génération automatique de la nouvelle semaine dès que la semaine cible change
    if (!st || st.week !== targetWeek() || st.ids.some((id) => !allRecipes().find((r) => r.id === id))) st = fresh(st?.sources?.length ? st.sources : SOURCES.map((x) => x.id));
    setS(st);
    if (st.validated) setTab("calendrier");
  }, []);
  useEffect(() => { if (s) localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);
  if (!s) return <p className="p-8">Chargement…</p>;
  if (s.ids.some((id) => !allRecipes().find((r) => r.id === id))) { setS(fresh(s.sources)); return null; } // recette supprimée

  const upd = (p: Partial<State>) => setS({ ...s, ...p });
  const recipes = s.ids.map(byId);
  const toggleSrc = (id: Src) => {
    const sources = s.sources.includes(id) ? s.sources.filter((x) => x !== id) : [...s.sources, id];
    if (sources.length) setS({ ...fresh(sources) }), setPicked([]);
  };
  const replace = () => {
    upd({ ids: replaceIds(s.ids, picked, s.sources, s.rejected), rejected: [...s.rejected, ...picked] });
    setPicked([]);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) upd({ ids: arrayMove(s.ids, s.ids.indexOf(String(active.id)), s.ids.indexOf(String(over.id))) });
  };
  const shopping = buildShoppingList(recipes);
  const weekLabel = new Date(s.week + "T12:00:00").toLocaleDateString("fr-BE", { day: "numeric", month: "long" });
  const tabs: [Tab, string, boolean][] = [["selection", "1. Sélection", true], ["calendrier", "2. Calendrier", true], ["courses", "3. Courses", s.validated]];

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">🍽️ RepasMalin <span className="text-base font-normal text-stone-500">semaine du {weekLabel}</span></h1>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {SOURCES.map((x) => (
            <label key={x.id} className="flex items-center gap-1.5"><input type="checkbox" checked={s.sources.includes(x.id)} onChange={() => toggleSrc(x.id)} />{x.label}</label>
          ))}
          <button onClick={() => { setS(fresh(s.sources)); setTab("selection"); setPicked([]); }} className="rounded border px-3 py-1 hover:bg-stone-100">🎲 Nouvelle semaine</button>
          <button onClick={() => setAdding(true)} className="rounded border px-3 py-1 hover:bg-stone-100">➕ Mes recettes</button>
        </div>
        <nav className="flex gap-2">
          {tabs.map(([t, l, ok]) => (
            <button key={t} disabled={!ok} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-emerald-600 text-white" : "bg-white border"} disabled:opacity-40`}>{l}</button>
          ))}
        </nav>
      </header>

      {tab === "selection" && (
        <section className="space-y-3">
          <p className="text-sm text-stone-600">Pas convaincu ? Coche 1 à 3 recettes ({picked.length}/3) puis remplace-les.</p>
          {recipes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3">
              <div><button onClick={() => setOpen(r)} className="text-left font-medium hover:underline">{r.title}</button>
                <span className={`ml-2 rounded px-1.5 text-xs ${badge(r.source)}`}>{r.source === "COOKOMIX" ? "Thermomix" : "Classique"}</span>
                <p className="text-xs text-stone-500">{r.prep + r.cook} min · {r.servings} portions</p></div>
              <button onClick={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : picked.length < 3 ? [...picked, r.id] : picked)}
                className={`shrink-0 rounded px-3 py-1 text-sm ${picked.includes(r.id) ? "bg-amber-500 text-white" : "bg-stone-100"}`}>🔄 Remplacer</button>
            </div>
          ))}
          <div className="flex gap-3">
            <button disabled={!picked.length} onClick={replace} className="rounded bg-amber-500 px-4 py-2 text-white disabled:opacity-40">Remplacer {picked.length || ""} recette(s)</button>
            <button onClick={() => setTab("calendrier")} className="rounded bg-emerald-600 px-4 py-2 text-white">Valider la sélection →</button>
          </div>
        </section>
      )}

      {tab === "calendrier" && (
        <section className="space-y-4">
          <p className="text-sm text-stone-600">Glisse-dépose les recettes pour choisir le jour.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={s.ids} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {recipes.map((r, i) => <DayCard key={r.id} recipe={r} day={DAYS[i]} onOpen={() => setOpen(r)} />)}
              </div>
            </SortableContext>
          </DndContext>
          <button onClick={() => { upd({ validated: true }); setTab("courses"); }} className="rounded bg-emerald-600 px-4 py-2 text-white">Valider le planning → liste de courses</button>
        </section>
      )}

      {tab === "courses" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Liste de courses</h2>
            <button onClick={() => window.print()} className="rounded border px-3 py-1 text-sm">🖨️ Imprimer</button></div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(shopping).map(([aisle, items]) => (
              <div key={aisle} className="rounded-xl border bg-white p-4">
                <h3 className="mb-2 font-semibold">{aisle}</h3>
                <ul className="space-y-1">
                  {items.map((i) => {
                    const done = s.checked.includes(i.key);
                    return (
                      <li key={i.key} className="flex items-start gap-2">
                        <input type="checkbox" checked={done} className="mt-1" onChange={() => upd({ checked: done ? s.checked.filter((x) => x !== i.key) : [...s.checked, i.key] })} />
                        <span className={done ? "text-stone-400 line-through" : ""}>{i.qty} {i.label}<span className="block text-xs text-stone-400">{i.from.join(", ")}</span></span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {adding && <AddRecipe onClose={() => setAdding(false)} onChange={() => refresh((n) => n + 1)} />}
      {open && <RecipeModal r={open} onClose={() => setOpen(null)} />}
    </main>
  );
}
