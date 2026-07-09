"""
pricing.py
-------------------------------------------------------------------------
Authoritative pricing + validation logic for the walk-in configurator.

The frontend keeps its own copy of these numbers (see frontend/js/config.js)
purely so the price bar can update instantly without a network round trip.
This module is the one that actually gets trusted: every configuration is
re-validated and re-priced here before a quote is ever produced, so a
tampered or buggy client payload can never result in an incorrect quote.
-------------------------------------------------------------------------
"""

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Business rules
# ---------------------------------------------------------------------------

DIMENSION_LIMITS = {
    "depth": (8, 200),     # ft, virtually limitless
    "width": (6, 200),     # ft, virtually limitless
    "height": (8, 20),     # ft
}

VALID_APP_TYPES = {"cooler", "freezer"}
VALID_FINISHES = {"galvalume", "stainless", "stucco"}
VALID_ENTRY_DOORS = {"front-left", "front-right", "side-left", "side-right"}
VALID_ACCESSORY_KEYS = {"ledLighting", "reinforcedFloor"}

MAX_DISPLAY_DOORS = 500  # Effectively limitless - validated by panel segments
PANEL_SEGMENT_FT = 4  # must match frontend/js/config.js PANEL_SEGMENT_FT

PRICING_RULES = {
    "base": {"cooler": 4200, "freezer": 6800},
    "per_square_foot": {"cooler": 38, "freezer": 54},
    "per_foot_of_height_above_8": 260,
    "display_door_each": 1439,
    "entry_door_each": 1329,
    "finish_multiplier": {"galvalume": 1.00, "stainless": 1.22, "stucco": 1.08},
    "accessories": {"ledLighting": 340, "reinforcedFloor": 960},
    # Panel pricing based on 44.5 inch (3.708 ft) panels
    "panel_pricing": {
        "panel_width_inches": 44.5,
        "panel_width_ft": 44.5 / 12,  # 3.708 ft
        "wall_panels": {
            "8ft": 245,   # 44.5 x 8 = $245
            "10ft": 295,  # 44.5 x 10 = $295
            "12ft": 335,  # 44.5 x 12 = $335
        },
        "roof_panels": {
            "8ft": 245,
            "10ft": 295,
            "12ft": 335,
        }
    },
    # Refrigeration equipment pricing
    "refrigeration": {
        "condensers": {
            "2_ton": 3895,
            "3_ton": 4495,
            "4_ton": 4895,
            "5_ton": 5109,
        },
        "evaporators": {
            "2_fan": 2260,
            "3_fan": 2600,
            "4_fan": 3195,
            "5_fan": 3495,
        }
    },
}


class ConfigurationError(ValueError):
    """Raised when an incoming configuration payload fails validation."""


@dataclass
class PriceLine:
    label: str
    amount: float


@dataclass
class PriceBreakdown:
    lines: list = field(default_factory=list)
    total: float = 0.0

    def as_dict(self) -> dict:
        return {
            "lines": [{"label": l.label, "amount": round(l.amount, 2)} for l in self.lines],
            "total": round(self.total, 2),
        }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_config(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Validates and normalizes a raw JSON configuration payload.
    Raises ConfigurationError with a human-readable message on any problem.
    Returns a cleaned dict safe to pass into calculate_price().
    """
    if not isinstance(payload, dict):
        raise ConfigurationError("Payload must be a JSON object.")

    app_type = payload.get("appType")
    if app_type not in VALID_APP_TYPES:
        raise ConfigurationError(f"appType must be one of {sorted(VALID_APP_TYPES)}.")

    dims = payload.get("dimensions")
    if not isinstance(dims, dict):
        raise ConfigurationError("dimensions must be an object with depth/width/height.")

    normalized_dims = {}
    for key in ("depth", "width", "height"):
        value = dims.get(key)
        if not isinstance(value, (int, float)):
            raise ConfigurationError(f"dimensions.{key} must be a number.")
        low, high = DIMENSION_LIMITS[key]
        if not (low <= value <= high):
            raise ConfigurationError(f"dimensions.{key} must be between {low} and {high} ft (got {value}).")
        normalized_dims[key] = float(value)

    display_doors = payload.get("displayDoors", 0)
    if not isinstance(display_doors, int) or display_doors < 0:
        raise ConfigurationError("displayDoors must be a non-negative integer.")
    if display_doors > MAX_DISPLAY_DOORS:
        raise ConfigurationError(f"displayDoors cannot exceed {MAX_DISPLAY_DOORS}.")

    entry_doors = payload.get("entryDoors", [])
    if not isinstance(entry_doors, list) or any(d not in VALID_ENTRY_DOORS for d in entry_doors):
        raise ConfigurationError(f"entryDoors must be a subset of {sorted(VALID_ENTRY_DOORS)}.")
    if len(set(entry_doors)) != len(entry_doors):
        raise ConfigurationError("entryDoors contains duplicate placements.")

    # Structural sanity check: the front wall can only physically fit so
    # many doors based on actual door widths (30" display, 36" entry).
    DISPLAY_DOOR_WIDTH = 2.5  # 30 inches = 2.5 ft
    ENTRY_DOOR_WIDTH = 3.0    # 36 inches = 3.0 ft

    available_width = normalized_dims["width"]
    front_entry_count = len({d for d in entry_doors if d.startswith("front-")})
    available_width -= front_entry_count * ENTRY_DOOR_WIDTH

    max_display_doors = int(available_width / DISPLAY_DOOR_WIDTH)
    if display_doors > max_display_doors:
        raise ConfigurationError(
            f"Too many display doors for the selected width: "
            f"{display_doors} display doors requested, but only {max_display_doors} can fit "
            f"in {normalized_dims['width']}ft width with {front_entry_count} front entry doors."
        )

    finish = payload.get("finish")
    if finish not in VALID_FINISHES:
        raise ConfigurationError(f"finish must be one of {sorted(VALID_FINISHES)}.")

    accessories = payload.get("accessories", {})
    if not isinstance(accessories, dict) or any(k not in VALID_ACCESSORY_KEYS for k in accessories):
        raise ConfigurationError(f"accessories keys must be a subset of {sorted(VALID_ACCESSORY_KEYS)}.")
    normalized_accessories = {k: bool(accessories.get(k, False)) for k in VALID_ACCESSORY_KEYS}

    return {
        "appType": app_type,
        "dimensions": normalized_dims,
        "displayDoors": display_doors,
        "entryDoors": entry_doors,
        "finish": finish,
        "accessories": normalized_accessories,
    }


# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------

def calculate_panel_count(dimension_ft: float, panel_width_ft: float) -> int:
    """
    Calculates the number of 44.5-inch panels needed for a given dimension.
    Rounds up to ensure full coverage.
    """
    import math
    return math.ceil(dimension_ft / panel_width_ft)


def get_panel_price_for_height(height_ft: float, panel_prices: dict) -> float:
    """
    Gets the appropriate panel price based on height.
    Rounds height to nearest standard size (8, 10, or 12 ft).
    """
    if height_ft <= 8:
        return panel_prices["8ft"]
    elif height_ft <= 10:
        return panel_prices["10ft"]
    else:
        return panel_prices["12ft"]


def calculate_refrigeration_requirements(config: dict[str, Any], rules: dict) -> dict:
    """
    Calculates refrigeration equipment requirements based on box volume and application type.
    Matches the logic in RefrigerationSystem.js.
    """
    dims = config["dimensions"]
    volume = dims["width"] * dims["depth"] * dims["height"]
    app_type = config["appType"]

    # Refrigeration sizing matrix based on cubic volume and application type
    refrigeration_matrix = {
        "cooler": [
            {"max_volume": 640, "condenser": "2_ton", "evaporator": "2_fan"},
            {"max_volume": 1120, "condenser": "3_ton", "evaporator": "3_fan"},
            {"max_volume": 1920, "condenser": "4_ton", "evaporator": "4_fan"},
            {"max_volume": float('inf'), "condenser": "5_ton", "evaporator": "5_fan"}
        ],
        "freezer": [
            {"max_volume": 400, "condenser": "2_ton", "evaporator": "2_fan"},
            {"max_volume": 800, "condenser": "3_ton", "evaporator": "3_fan"},
            {"max_volume": 1300, "condenser": "4_ton", "evaporator": "4_fan"},
            {"max_volume": float('inf'), "condenser": "5_ton", "evaporator": "5_fan"}
        ]
    }

    matrix = refrigeration_matrix[app_type]
    equipment = next((tier for tier in matrix if volume <= tier["max_volume"]), None)

    if not equipment:
        return None

    condenser_price = rules["refrigeration"]["condensers"][equipment["condenser"]]
    evaporator_price = rules["refrigeration"]["evaporators"][equipment["evaporator"]]

    return {
        "volume": volume,
        "condenser": equipment["condenser"],
        "evaporator": equipment["evaporator"],
        "condenser_price": condenser_price,
        "evaporator_price": evaporator_price,
        "requires_3_phase": equipment["condenser"] == "5_ton"
    }


def calculate_panel_costs(config: dict[str, Any], rules: dict) -> dict:
    """
    Calculates total wall and roof panel costs based on 44.5-inch panel pricing.
    Returns a dict with wall and roof panel information.
    """
    import math

    panel_pricing = rules["panel_pricing"]
    dims = config["dimensions"]
    height = dims["height"]
    panel_width_inches = panel_pricing["panel_width_inches"]

    # Convert dimensions to inches and calculate panels needed
    width_inches = dims["width"] * 12
    depth_inches = dims["depth"] * 12

    # Back wall panels = width in inches / 44.5, rounded up
    back_wall_panels = math.ceil(width_inches / panel_width_inches)

    # Side wall panels = depth in inches / 44.5, rounded up (for each side)
    side_wall_panels = math.ceil(depth_inches / panel_width_inches)

    # Front wall panels = same as back wall
    front_wall_panels = back_wall_panels

    # Subtract 1 panel for side entry doors
    has_side_entry = any(door.startswith("side-") for door in config["entryDoors"])
    if has_side_entry:
        # Subtract 1 panel from front wall for door framing
        front_wall_panels = max(0, front_wall_panels - 1)

    # Total wall panels: front + back + both sides
    total_wall_panels = front_wall_panels + back_wall_panels + (side_wall_panels * 2)
    wall_panel_price = get_panel_price_for_height(height, panel_pricing["wall_panels"])
    wall_panels_cost = total_wall_panels * wall_panel_price

    # Roof panels: same as back wall (width dimension)
    total_roof_panels = back_wall_panels
    roof_panel_price = get_panel_price_for_height(height, panel_pricing["roof_panels"])
    roof_panels_cost = total_roof_panels * roof_panel_price

    return {
        "wall_panels": {
            "count": total_wall_panels,
            "price_each": wall_panel_price,
            "total": wall_panels_cost
        },
        "roof_panels": {
            "count": total_roof_panels,
            "price_each": roof_panel_price,
            "total": roof_panels_cost
        }
    }


def calculate_price(config: dict[str, Any]) -> PriceBreakdown:
    """Computes an itemized price breakdown for an already-validated config."""
    rules = PRICING_RULES
    breakdown = PriceBreakdown()

    app_type = config["appType"]
    dims = config["dimensions"]

    base = rules["base"][app_type]
    breakdown.lines.append(PriceLine(f"Base unit ({app_type})", base))

    # Use panel-based pricing instead of per-square-foot
    panel_costs = calculate_panel_costs(config, rules)

    breakdown.lines.append(
        PriceLine(
            f"Wall panels ({panel_costs['wall_panels']['count']} panels × ${panel_costs['wall_panels']['price_each']})",
            panel_costs['wall_panels']['total']
        )
    )

    breakdown.lines.append(
        PriceLine(
            f"Roof panels ({panel_costs['roof_panels']['count']} panels × ${panel_costs['roof_panels']['price_each']})",
            panel_costs['roof_panels']['total']
        )
    )

    if config["displayDoors"] > 0:
        cost = config["displayDoors"] * rules["display_door_each"]
        breakdown.lines.append(PriceLine(f"Glass display doors ×{config['displayDoors']}", cost))

    if config["entryDoors"]:
        cost = len(config["entryDoors"]) * rules["entry_door_each"]
        breakdown.lines.append(PriceLine(f"Entry doors ×{len(config['entryDoors'])}", cost))

    accessory_labels = {
        "ledLighting": "LED lighting track",
        "reinforcedFloor": "Reinforced flooring",
    }
    for key, enabled in config["accessories"].items():
        if enabled:
            breakdown.lines.append(PriceLine(accessory_labels[key], rules["accessories"][key]))

    # Add refrigeration equipment costs
    refrigeration = calculate_refrigeration_requirements(config, rules)
    if refrigeration:
        condenser_label = refrigeration["condenser"].replace("_", " ")
        evaporator_label = refrigeration["evaporator"].replace("_", " ")
        breakdown.lines.append(
            PriceLine(f"Condensing unit ({condenser_label})", refrigeration["condenser_price"])
        )
        breakdown.lines.append(
            PriceLine(f"Evaporator coil ({evaporator_label})", refrigeration["evaporator_price"])
        )

    subtotal = sum(line.amount for line in breakdown.lines)
    multiplier = rules["finish_multiplier"][config["finish"]]
    if multiplier != 1.0:
        finish_labels = {"galvalume": "Galvalume", "stainless": "Stainless steel", "stucco": "White stucco"}
        breakdown.lines.append(
            PriceLine(f"{finish_labels[config['finish']]} finish adjustment", subtotal * (multiplier - 1))
        )

    breakdown.total = subtotal * multiplier
    return breakdown
