import json
import re


INPUT="data/processed/raw_pages.jsonl"
OUTPUT="data/processed/clean_pages.jsonl"


def clean(text):

    # remove years
    text=re.sub(r"\b20\d{2}\b","",text)

    # remove excessive spaces
    text=re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()



count=0


with open(INPUT,encoding="utf-8") as f, \
     open(OUTPUT,"w",encoding="utf-8") as out:

    for line in f:

        item=json.loads(line)

        item["text"]=clean(
            item["text"]
        )

        if len(item["text"]) > 50:

            out.write(
                json.dumps(
                    item,
                    ensure_ascii=False
                )+"\n"
            )

            count+=1


print("Saved:",count)