# Trip.com Combination Branch Search

## Context

Trip.com only reveals return options after an outbound flight is selected. That
means a date-pair search is not a flat list; it is a branching search tree.

The previous worker model chose one promising outbound card and then inspected
return options behind that single branch. That under-sampled the real Trip.com
search space and could miss cheaper overall round-trip combinations hidden
behind the second or third outbound option.

## Goal

- treat each direct query as a bounded outbound-return combination search
- sample multiple outbound branches before scoring round-trip candidates
- keep the search bounded so run time remains practical
- preserve explainability in the recorded query summaries

## Scope

Included:

- bounded direct-query outbound branch exploration
- bounded return sampling per outbound branch
- bounded stopover follow-up branch exploration using the same model
- richer query summaries describing how many outbound branches and return cards
  were explored

Not included:

- exhaustive search across all Trip.com outbound and return branches
- schema changes for separate outbound-observation and return-observation tables

## Outcome

Implemented:

- direct round-trip queries now explore multiple outbound branches per date pair
- each outbound branch samples multiple return options before candidate scoring
- stopover follow-up queries use the same branching model
- query summaries now record branch counts and card-scan coverage so later
  analysis can reason about how much of the Trip.com branch space was sampled
