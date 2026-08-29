import json, re, urllib.request, hashlib
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = ROOT / "research/data/v2/evaluation/closed_book_eval_candidates_v2r5_reviewed.jsonl"
CHUNKS = ROOT / "research/data/v2/chunks/nctb_eval_question_source_chunks_v2r3.jsonl"
OUT = ROOT / "research/data/v2/evaluation/closed_book_eval_candidates_v2r6.jsonl"

BAD = {
    "CBQ-C6-005",
    "CBQ-C6-041",
}

EDIT = {
    "CBQ-C6-049": (
        "What are common occupations for many villagers in rural Bangladesh?",
        "farmers, fishermen, or craftsmen"
    ),
    "CBQ-C7-020": (
        "What should family members do for one another?",
        "live together and support each other"
    ),
    "CBQ-C8-012": (
        "Where do many small ethnic communities of Bangladesh live peacefully?",
        "in the hills, plains and forests"
    ),
    "CBQ-C8-045": (
        "Which folk music genre is associated with boatmen?",
        "Bhatiyali"
    ),
}

def sha256_file(p):
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(1024*1024), b""):
            h.update(b)
    return h.hexdigest()

def load_jsonl(p):
    out=[]
    with p.open("r",encoding="utf-8-sig") as f:
        for line in f:
            if line.strip():
                out.append(json.loads(line))
    return out

def norm(s):
    return " ".join(re.sub(r"[^a-z0-9]+"," ",str(s).lower()).split())

def call(model,prompt):
    payload={
        "model":model,
        "stream":False,
        "format":"json",
        "messages":[{"role":"user","content":prompt}],
        "options":{"temperature":0.08,"num_predict":700}
    }
    req=urllib.request.Request(
        "http://127.0.0.1:11434/api/chat",
        data=json.dumps(payload,ensure_ascii=False).encode(),
        headers={"Content-Type":"application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req,timeout=180) as r:
        return json.loads(r.read().decode())

items = load_jsonl(SOURCE)
chunks = load_jsonl(CHUNKS)
by_id = {x["chunk_id"]:x for x in chunks}

kept = [x for x in items if x["candidate_id"] not in BAD]

# Apply deterministic edits.
for x in kept:
    if x["candidate_id"] in EDIT:
        q,a = EDIT[x["candidate_id"]]
        x["question"]=q
        x["gold_answer"]=a
        x["human_review_action"]="EDIT_CONFIRMED"

# Generate exactly two replacements from clean sources.
targets = [
    ("class6-english", 3),
    ("class6-english", 3),
]

used = {norm(x["question"]) for x in kept}

class6_sources = [
    x for x in chunks
    if x["book_id"]=="class6-english"
    and x["chunk_id"] not in {
        "class6-english-chunk-0026",
        "class6-english-chunk-0054"
    }
]

new=[]
for src in class6_sources:
    prompt=f"""
Generate 4 closed-book short-answer benchmark questions from the source.

Requirements:
- self-contained
- no "according to the passage"
- no opinions
- answer 1-10 words
- answer must be copied exactly from SOURCE
- avoid exercise instructions and MCQ options
- avoid page numbers/headings
- questions must test actual textbook knowledge

Return JSON only:
{{"questions":[{{"question":"...?","gold_answer":"..."}}]}}

SOURCE:
{src["text"]}
""".strip()

    try:
        r=call("gemma3:latest",prompt)
        content=r["message"]["content"]
        data=json.loads(content)
    except Exception:
        continue

    for q in data.get("questions",[]):
        question=str(q.get("question","")).strip()
        answer=str(q.get("gold_answer","")).strip()
        if not question.endswith("?"):
            continue
        if not answer or len(answer.split())>10:
            continue
        nq=norm(question)
        if nq in used:
            continue
        source_text=src["text"].lower()
        if answer.lower() not in source_text:
            continue

        new.append({
            "version":"closed-book-benchmark-candidates-v2r6",
            "class_level":6,
            "book_id":src["book_id"],
            "chunk_id":src["chunk_id"],
            "page_start":src["page_start"],
            "page_end":src["page_end"],
            "question":question,
            "gold_answer":answer,
            "evidence_quote":answer,
            "author_model":"gemma3:latest",
            "auto_validation":"PASS",
            "human_review_action":"REPLACEMENT_CANDIDATE"
        })
        used.add(nq)
        if len(new)>=2:
            break

    if len(new)>=2:
        break

if len(new)!=2:
    raise SystemExit(f"Could not generate 2 replacements. Got {len(new)}")

kept.extend(new)
kept.sort(key=lambda x:(int(x["class_level"]),x["candidate_id"]))

# Re-number IDs to keep 50/50/50 distribution.
from collections import Counter
serial=Counter()
for x in kept:
    c=int(x["class_level"])
    serial[c]+=1
    x["candidate_id"]=f"CBQ-C{c}-{serial[c]:03d}"

with OUT.open("w",encoding="utf-8") as f:
    for x in kept:
        f.write(json.dumps(x,ensure_ascii=False)+"\n")

print()
print("="*78)
print("V2R6 BENCHMARK CREATED")
print("="*78)
print("Total:",len(kept))
for c in (6,7,8):
    print(f"Class {c}:",sum(1 for x in kept if int(x["class_level"])==c))
print("SHA256:",sha256_file(OUT))
print("Output:",OUT.relative_to(ROOT))
print()
print("Next: run the final automatic audit + fresh 15-question spot-check.")
