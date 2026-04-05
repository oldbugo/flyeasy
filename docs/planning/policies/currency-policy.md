# FlyEasy Currency Policy

## Purpose

Define how FlyEasy handles displayed currency, verified currency, comparisons, and change summaries so price remains trustworthy across the product.

## Why This Exists

FlyEasy compares prices from Trip.com search and deep verification flows.

If the product does not define a clear currency rule, users may see mismatched or misleading comparisons.

## Core Principles

- The product should optimize for trust and comparability, not raw source fidelity alone.
- The user needs one primary comparison currency in the UI.
- Source currency should remain accessible when relevant.
- Conversion should be clearly labeled if used.

## Primary Display Currency

For v1, FlyEasy should use one primary display currency per user environment.

Recommended default:

- AUD as the primary display currency for this initial user context

Generalized rule:

- use the user's configured home currency as the primary display currency

## Source Currency Versus Display Currency

Each price observation should retain:

- source currency from Trip.com
- source amount

The UI should primarily show:

- normalized display currency amount

The UI may additionally show:

- source price and currency when useful in detail views

## Comparison Rule

All ranking and comparison surfaces should use the normalized display currency amount.

This includes:

- dashboard summaries
- candidate cards
- compare view
- monitoring change summaries

This is necessary because users cannot compare mixed currencies reliably at a glance.

## Detail View Rule

Candidate detail views may show both:

- display currency amount
- source Trip.com amount and currency

Recommended presentation:

- primary line: `AUD 612 verified`
- secondary line: `Trip.com showed CNY ...` or equivalent source value if materially useful

If the source and display currency are the same, do not show redundant dual lines.

## Conversion Rule

For v1:

- convert prices into the primary display currency at ingestion or comparison time using one consistent exchange-rate source
- label converted values clearly if source currency differs

The app should not pretend the converted amount is the same thing as the exact payable card settlement amount.

### Exchange-Rate Audit Requirement

When conversion is used, the system should retain enough metadata to explain the displayed value later.

Recommended fields:

- exchange-rate provider identifier
- applied FX rate
- FX-rate timestamp

This prevents later monitoring deltas from becoming unauditable.

## Ranking Rule

Ranking should use:

- verified normalized display-currency price first
- displayed normalized display-currency price only when verified price is unavailable

This keeps ranking aligned with product trust rules.

## Change Summary Rule

Price change summaries should compare normalized display-currency amounts.

Examples:

- `Down AUD 34 since yesterday`
- `Up AUD 28 after re-verification`

If a change is driven mainly by currency fluctuation rather than source price movement, the UI should avoid overstating it as a fare change if that distinction can be detected later.

## UX Language Guidance

Use:

- `AUD 612 verified`
- `AUD 645 displayed on Trip.com`
- `Converted from CNY`

Avoid:

- unlabeled mixed-currency figures
- source and converted prices with no explanation of which one drives ranking

## Data Requirements

The data model should support:

- source currency
- source amount
- normalized display currency
- normalized amount
- exchange-rate provider identifier
- exchange-rate timestamp
- applied FX-rate reference

If schema simplification is needed in v1, at minimum preserve enough information to explain why the UI value is in the chosen display currency.

## Current Recommendation

For v1:

- use a single primary display currency for comparisons
- retain source currency in the data layer
- show source currency mainly in detail contexts
- base ranking and change summaries on normalized display-currency values

This keeps prices understandable, comparable, and honest.
