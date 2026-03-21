# Survey Templates

Templates for AskUserQuestion calls during check-in.

## Action Item Review

For each active action item:

```
question: "Action item: [description]. How's your progress?"
header: "[short category]"  // max 12 chars, e.g. "Voice mode"
options:
  - label: "Done"
    description: "Fully completed — I've adopted this change."
  - label: "Partial"
    description: "Made some progress but not fully there yet."
  - label: "Not started"
    description: "Haven't had a chance to try this yet."
  - label: "Abandon"
    description: "Decided this isn't worth pursuing — skip it."
multiSelect: false
```

## New Action Items Confirmation

After generating proposed action items:

```
question: "Which of these improvements do you want to commit to?"
header: "New goals"
options:
  - label: "[item 1 short name]"
    description: "[full description + measurable outcome]"
  - label: "[item 2 short name]"
    description: "[full description + measurable outcome]"
  - label: "[item 3 short name]"
    description: "[full description + measurable outcome]"
  - label: "[item 4 short name]"
    description: "[full description + measurable outcome]"
multiSelect: true
```

## Portfolio Priority

When portfolio-scout flags multiple projects for action:

```
question: "Portfolio scout flagged these projects. Which do you want to address?"
header: "Portfolio"
options:
  - label: "[project 1]: [action]"
    description: "[reasoning]"
  - label: "[project 2]: [action]"
    description: "[reasoning]"
  - label: "[project 3]: [action]"
    description: "[reasoning]"
  - label: "Skip portfolio actions"
    description: "Not ready to make portfolio changes right now."
multiSelect: true
```

## Self-Evolution

```
question: "Should we change how we track efficiency?"
header: "Evolution"
options:
  - label: "No changes"
    description: "Current metrics and process are working fine."
  - label: "Add metrics"
    description: "I noticed something we should track that we don't."
  - label: "Drop metrics"
    description: "Some metrics aren't useful — let's stop tracking them."
  - label: "Change process"
    description: "The review workflow itself needs adjustment."
multiSelect: false
```

## Research Findings Triage

When research-scout returns multiple findings:

```
question: "Which of these findings do you want to act on?"
header: "Research"
options:
  - label: "[finding 1]"
    description: "[summary + relevance]"
  - label: "[finding 2]"
    description: "[summary + relevance]"
  - label: "[finding 3]"
    description: "[summary + relevance]"
  - label: "None for now"
    description: "Interesting but not actionable right now."
multiSelect: true
```
