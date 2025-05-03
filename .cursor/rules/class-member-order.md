# Class Member Ordering Convention

This document outlines the agreed-upon ordering for members within TypeScript classes in this project.

The general order is as follows:

1.  **Static Methods**: Public static methods that are *not* related to JSON handling or cloning.
2.  **Public Instance Properties**: Standard public fields/properties.
3.  **Private Instance Properties**: Fields/properties prefixed with `#`.
4.  **Constructor**: The `constructor` method.
5.  **Getters/Setters**: Public instance getters and setters.
6.  **Public Instance Methods**: Public methods that are *not* related to JSON handling or cloning.
7.  **JSON & Clone Section**: A dedicated section grouping related functionality:
    *   Static JSON-related properties (e.g., `jsonOrder`, `emptyJson`).
    *   Static Clone-related methods (e.g., `cloneList`).
    *   Instance JSON-related methods (e.g., `toJSON`, `toJsonText`).
    *   Instance `clone` method.

Sections with no members (e.g., if a class has no private properties) should simply be omitted, including their comment headers. 