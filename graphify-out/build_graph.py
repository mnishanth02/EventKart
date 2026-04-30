import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.export import to_json

print("Loading extraction and detection...")
extraction = json.loads(Path("graphify-out/.graphify_extract.json").read_text())
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text())

print(f"Building graph from {len(extraction['nodes'])} nodes...")
G = build_from_json(extraction)
print(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

print("Running clustering...")
communities = cluster(G)
print(f"Found {len(communities)} communities")

cohesion = score_all(G, communities)
tokens = {"input": 0, "output": 0}

print("Analyzing graph...")
gods = god_nodes(G)
print("God nodes (highest degree):")
for god in gods[:5]:
    print(f"  - {god['label']} ({god['degree']} connections)")

surprises = surprising_connections(G, communities)
print(f"\nSurprising connections: {len(surprises)}")

questions = suggest_questions(G, communities, {})

print("\nExporting to JSON...")
# Force overwrite the graph
Path("graphify-out/graph.json.backup").write_text(Path("graphify-out/graph.json").read_text())
to_json(G, communities, "graphify-out/graph.json")

analysis = {
    "communities": {str(k): list(v)[:5] for k, v in communities.items()},
    "cohesion": {str(k): v for k, v in cohesion.items()},
    "gods": [{"id": g["id"], "label": g["label"], "degree": g["degree"]} for g in gods[:5]],
    "surprises": surprises[:3],
    "questions": questions[:5],
}
Path("graphify-out/.graphify_analysis.json").write_text(json.dumps(analysis, indent=2))

# Write simple markdown report
report_lines = [
    "# EventKart Knowledge Graph Report",
    "",
    f"**Total Nodes:** {G.number_of_nodes()}",
    f"**Total Edges:** {G.number_of_edges()}",
    f"**Communities:** {len(communities)}",
    "",
    "## God Nodes (Highest Degree)",
    "",
]
for god in gods[:5]:
    report_lines.append(f"- **{god['label']}** - {god['degree']} connections")

report_lines.extend([
    "",
    "## Communities Detected",
    "",
])
for cid, nodes in list(communities.items())[:5]:
    report_lines.append(f"- Community {cid}: {len(nodes)} nodes")

report_lines.extend([
    "",
    "## Suggested Questions",
    "",
])
for i, q in enumerate(questions[:5], 1):
    report_lines.append(f"{i}. {q}")

report = "\n".join(report_lines)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")

print("\nGraph complete!")
print("Outputs:")
print("  - graphify-out/graph.json")
print("  - graphify-out/GRAPH_REPORT.md")
print("  - graphify-out/.graphify_analysis.json")
