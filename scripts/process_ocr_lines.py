import json
import re
from pathlib import Path


INPUT = Path(
    "public/ocr/books/test/page-18.json"
)

OUTPUT = Path(
    "public/ocr/books/test/page-18-lines.json"
)


def clean_text(text):

    text = text.strip()

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text


def remove_bad_line(text):

    if not text:
        return True

    bad_patterns = [
        r"^\d+$",
        r"^[A-D]\.$",
        r"^[a-d]\)$",
        r"^[•●▪]",
        r"^\.$"
    ]

    for p in bad_patterns:
        if re.match(p,text):
            return True

    return False



with open(
    INPUT,
    "r",
    encoding="utf-8"
) as f:

    words=json.load(f)



lines=[]

current=[]

current_y=None



for word in words:

    y=word["y"]

    text=word["text"]


    if current_y is None:

        current_y=y


    # same line
    if abs(y-current_y)<20:

        current.append(word)


    else:

        if current:

            lines.append(current)

        current=[word]

        current_y=y



if current:
    lines.append(current)



final=[]



for index,line in enumerate(lines,1):


    line.sort(
        key=lambda x:x["x"]
    )


    text=" ".join(
        w["text"]
        for w in line
    )


    text=clean_text(text)


    if remove_bad_line(text):
        continue



    x=min(
        w["x"]
        for w in line
    )


    y=min(
        w["y"]
        for w in line
    )


    right=max(
        w["x"]+w["width"]
        for w in line
    )


    bottom=max(
        w["y"]+w["height"]
        for w in line
    )


    final.append(
        {
        "id":f"line-{index}",
        "lineNumber":index,
        "text":text,
        "bbox":{
            "x":x,
            "y":y,
            "width":right-x,
            "height":bottom-y
        },
        "aiReady":True
        }
    )



with open(
    OUTPUT,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        final,
        f,
        indent=2,
        ensure_ascii=False
    )


print("DONE")
print("Lines created:",len(final))
print("Saved:",OUTPUT)