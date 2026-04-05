# Baseline Return-Option Expansion And Family Coverage

## Status

`Complete`

## Problem

The round-trip baseline was still too shallow after the first return-results
surface.

Two gaps remained:

- some stopover-city patterns only become visible after opening a cheap winner
  and inspecting deeper return options
- a naive cheapest-first expansion budget can get trapped in one repeated
  airline-and-stopover family, which leaves other plausible families untested

## Decision

The baseline now includes a bounded `Return option expansion` pass between
direct sweep and pass-1 analysis.

That pass:

- takes the cheap direct-sweep winners as input
- selects expansion targets by candidate family coverage first, not just raw
  price order
- adds deterministic randomness inside small price bands so the same family
  does not always monopolise the expansion budget
- opens deeper return options for the selected winners
- records any additional stopover-city clues exposed by that deeper stage

## Family-Coverage Rule

Expansion targets are no longer chosen top-to-bottom only.

The worker now:

- groups cheap winners into candidate families using airline, stopover pattern,
  and stop count
- spends the first expansion pass across distinct families before it repeats a
  family
- prefers new date buckets inside a family before revisiting similar dates
- stops spending more queries on a family once repeated expansions stop
  surfacing new stopover-city insight

## Result

The round-trip baseline is now better aligned with its actual job:

- identify promising dates
- identify promising airline families
- identify recurring stopover-city clues

That gives the next strategy cluster a stronger baseline to build on without
turning the opening sweep into a brute-force deep search.
