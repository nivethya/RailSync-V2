"""
RailSync large-scale operational demo seed.

Creates a scalable, linked demo dataset for SIH judging:
- 50 railway corridors
- 1,000 track segments
- 400 workers (+ fixed demo accounts)
- 2,000 maintenance jobs/faults
- skills, availability, attendance
- historical/current assignments
- work logs, extension requests
- disruptions, affected trains, route alternatives

IMPORTANT:
- Data is synthetic/demo operational data.
- Fixed judge accounts use password: RailSync@123
- Safe to re-run after deleting prior operational/demo rows manually or after resetting DB.
"""

import asyncio
import math
import random
from datetime import date, datetime, time, timedelta, timezone

from geoalchemy2.elements import WKTElement
from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.operations import (
    AlternativeStatus,
    AssignmentStatus,
    AttendanceStatus,
    DisruptionEvent,
    DisruptionStatus,
    ExtensionRequest,
    ExtensionStatus,
    FaultEvent,
    FaultSeverity,
    FaultStatus,
    JobStatus,
    MaintenanceJob,
    RailwayCorridor,
    RouteAlternative,
    TrackSegment,
    WorkerAssignment,
    WorkerAttendance,
    WorkerAvailability,
    WorkerAvailabilityStatus,
    WorkerProfile,
    WorkerSkill,
    WorkLog,
)

RNG = random.Random(26027)
NOW = datetime.now(timezone.utc)
PASSWORD = "RailSync@123"
PASSWORD_HASH = None

TARGET_CORRIDORS = 50
TARGET_SEGMENTS = 1000
TARGET_WORKERS = 400
TARGET_JOBS = 2000

ZONES = [
    ("SR", "Southern Railway", "Chennai", "Tamil Nadu"),
    ("CR", "Central Railway", "Mumbai", "Maharashtra"),
    ("WR", "Western Railway", "Mumbai", "Maharashtra"),
    ("NR", "Northern Railway", "Delhi", "Delhi"),
    ("ER", "Eastern Railway", "Kolkata", "West Bengal"),
    ("SER", "South Eastern Railway", "Kolkata", "West Bengal"),
    ("SCR", "South Central Railway", "Secunderabad", "Telangana"),
    ("SWR", "South Western Railway", "Hubballi", "Karnataka"),
    ("NCR", "North Central Railway", "Prayagraj", "Uttar Pradesh"),
    ("NER", "North Eastern Railway", "Gorakhpur", "Uttar Pradesh"),
]

# Approximate DEMO_REPLAY railway-control points.
# These are used only to keep synthetic operational data geographically plausible.
# They are NOT claimed to be official Indian Railways track geometry.
RAIL_NODES = {
    "MAS": ("Chennai Central", 13.0827, 80.2707, "Tamil Nadu"),
    "TBM": ("Tambaram", 12.9249, 80.1000, "Tamil Nadu"),
    "CGL": ("Chengalpattu", 12.6926, 79.9770, "Tamil Nadu"),
    "VM": ("Villupuram", 11.9401, 79.4861, "Tamil Nadu"),
    "TPJ": ("Tiruchirappalli", 10.7905, 78.7047, "Tamil Nadu"),
    "MDU": ("Madurai", 9.9252, 78.1198, "Tamil Nadu"),
    "CBE": ("Coimbatore", 11.0168, 76.9558, "Tamil Nadu"),
    "ERS": ("Ernakulam", 9.9687, 76.2914, "Kerala"),
    "TVC": ("Thiruvananthapuram", 8.4875, 76.9525, "Kerala"),

    "SBC": ("Bengaluru", 12.9784, 77.5695, "Karnataka"),
    "MYS": ("Mysuru", 12.2958, 76.6394, "Karnataka"),
    "UBL": ("Hubballi", 15.3647, 75.1240, "Karnataka"),
    "BGM": ("Belagavi", 15.8497, 74.4977, "Karnataka"),

    "SC": ("Secunderabad", 17.4344, 78.5013, "Telangana"),
    "BZA": ("Vijayawada", 16.5193, 80.6305, "Andhra Pradesh"),
    "GNT": ("Guntur", 16.3067, 80.4365, "Andhra Pradesh"),
    "VSKP": ("Visakhapatnam", 17.6868, 83.2185, "Andhra Pradesh"),

    "BBS": ("Bhubaneswar", 20.2666, 85.8436, "Odisha"),
    "KGP": ("Kharagpur", 22.3398, 87.3250, "West Bengal"),
    "HWH": ("Howrah", 22.5839, 88.3420, "West Bengal"),

    "CSMT": ("Mumbai CSMT", 18.9402, 72.8356, "Maharashtra"),
    "TNA": ("Thane", 19.1860, 72.9754, "Maharashtra"),
    "PUNE": ("Pune", 18.5286, 73.8743, "Maharashtra"),
    "NGP": ("Nagpur", 21.1458, 79.0882, "Maharashtra"),
    "BSL": ("Bhusaval", 21.0436, 75.7875, "Maharashtra"),

    "ADI": ("Ahmedabad", 23.0260, 72.6000, "Gujarat"),
    "BRC": ("Vadodara", 22.3072, 73.1812, "Gujarat"),
    "ST": ("Surat", 21.1702, 72.8311, "Gujarat"),

    "JP": ("Jaipur", 26.9196, 75.7878, "Rajasthan"),
    "AII": ("Ajmer", 26.4499, 74.6399, "Rajasthan"),
    "KOTA": ("Kota", 25.2138, 75.8648, "Rajasthan"),

    "NDLS": ("New Delhi", 28.6430, 77.2195, "Delhi"),
    "GZB": ("Ghaziabad", 28.6692, 77.4538, "Uttar Pradesh"),
    "AGC": ("Agra", 27.1767, 78.0081, "Uttar Pradesh"),
    "CNB": ("Kanpur", 26.4499, 80.3319, "Uttar Pradesh"),
    "LKO": ("Lucknow", 26.8315, 80.9223, "Uttar Pradesh"),
    "PRYJ": ("Prayagraj", 25.4358, 81.8463, "Uttar Pradesh"),
    "GKP": ("Gorakhpur", 26.7606, 83.3732, "Uttar Pradesh"),

    "PNBE": ("Patna", 25.6022, 85.1376, "Bihar"),
    "GAYA": ("Gaya", 24.7955, 84.9994, "Bihar"),
    "DDU": ("Pt. Deen Dayal Upadhyaya", 25.2815, 83.1198, "Uttar Pradesh"),
}

# Approximate railway adjacency graph for DEMO_REPLAY.
# Every synthetic corridor is routed through these land-based hubs rather than
# drawing a single straight line between distant cities.
RAIL_EDGES = [
    ("MAS", "TBM"), ("TBM", "CGL"), ("CGL", "VM"), ("VM", "TPJ"),
    ("TPJ", "MDU"), ("TPJ", "CBE"), ("CBE", "ERS"), ("ERS", "TVC"),
    ("MAS", "SBC"), ("SBC", "MYS"), ("SBC", "UBL"), ("UBL", "BGM"),
    ("BGM", "PUNE"), ("PUNE", "CSMT"), ("CSMT", "TNA"),
    ("PUNE", "BSL"), ("BSL", "NGP"), ("NGP", "SC"),
    ("SC", "BZA"), ("BZA", "GNT"), ("BZA", "VSKP"),
    ("VSKP", "BBS"), ("BBS", "KGP"), ("KGP", "HWH"),
    ("NGP", "PRYJ"), ("PRYJ", "DDU"), ("DDU", "PNBE"),
    ("PNBE", "HWH"), ("PNBE", "GAYA"), ("GAYA", "DDU"),
    ("NDLS", "GZB"), ("NDLS", "AGC"), ("AGC", "CNB"),
    ("CNB", "LKO"), ("CNB", "PRYJ"), ("LKO", "GKP"),
    ("GKP", "PNBE"), ("AGC", "JP"), ("JP", "AII"),
    ("AII", "KOTA"), ("KOTA", "BRC"), ("BRC", "ADI"),
    ("BRC", "ST"), ("ST", "CSMT"),
    ("KOTA", "NGP"),
]

# Fixed corridor origin/destination pairs. The first one is the SIH judge route.
CORRIDOR_PAIRS = [
    ("MAS", "TBM"),
    ("MAS", "CGL"),
    ("MAS", "TPJ"),
    ("MAS", "MDU"),
    ("MAS", "CBE"),
    ("MAS", "SBC"),
    ("MAS", "SC"),
    ("MAS", "BZA"),
    ("MAS", "VSKP"),
    ("MAS", "HWH"),
    ("TBM", "CGL"),
    ("CGL", "TPJ"),
    ("TPJ", "MDU"),
    ("TPJ", "CBE"),
    ("CBE", "ERS"),
    ("ERS", "TVC"),
    ("SBC", "MYS"),
    ("SBC", "UBL"),
    ("UBL", "BGM"),
    ("BGM", "PUNE"),
    ("PUNE", "CSMT"),
    ("CSMT", "TNA"),
    ("CSMT", "ST"),
    ("CSMT", "ADI"),
    ("CSMT", "NGP"),
    ("PUNE", "NGP"),
    ("NGP", "SC"),
    ("SC", "BZA"),
    ("BZA", "VSKP"),
    ("VSKP", "BBS"),
    ("BBS", "HWH"),
    ("NGP", "PRYJ"),
    ("PRYJ", "DDU"),
    ("DDU", "PNBE"),
    ("PNBE", "HWH"),
    ("NDLS", "GZB"),
    ("NDLS", "AGC"),
    ("NDLS", "CNB"),
    ("NDLS", "LKO"),
    ("NDLS", "JP"),
    ("AGC", "JP"),
    ("AGC", "CNB"),
    ("CNB", "LKO"),
    ("CNB", "PRYJ"),
    ("LKO", "GKP"),
    ("GKP", "PNBE"),
    ("JP", "AII"),
    ("AII", "KOTA"),
    ("KOTA", "BRC"),
    ("BRC", "ADI"),
]


SKILL_PROFILES = [
    ("TRACK_MAINTENANCE", "Track Maintenance", "P-WAY", "ENGINEERING"),
    ("SIGNAL_TELECOM", "Signal & Telecom", "S&T", "SIGNAL"),
    ("TRACTION_DISTRIBUTION", "Traction Distribution", "TRD", "ELECTRICAL"),
    ("CIVIL_TRACK", "Civil / Track Works", "ENGINEERING", "ENGINEERING"),
]

JOB_TEMPLATES = [
    ("TRACK", "RAIL_CRACK", "Rail Crack Inspection and Repair", "TRACK_MAINTENANCE", "P-WAY"),
    ("TRACK", "FASTENER_DEFECT", "Fastener Replacement", "TRACK_MAINTENANCE", "P-WAY"),
    ("TRACK", "TRACK_ALIGNMENT", "Track Alignment Correction", "TRACK_MAINTENANCE", "P-WAY"),
    ("TRACK", "BALLAST_DEFICIENCY", "Ballast Packing and Correction", "CIVIL_TRACK", "ENGINEERING"),
    ("POINT_MACHINE", "POINT_MACHINE_FAILURE", "Point Machine Inspection", "SIGNAL_TELECOM", "S&T"),
    ("SIGNAL", "SIGNAL_CABLE_FAULT", "Signal Cable Fault Rectification", "SIGNAL_TELECOM", "S&T"),
    ("SIGNAL", "TRACK_CIRCUIT_FAILURE", "Track Circuit Failure Inspection", "SIGNAL_TELECOM", "S&T"),
    ("SIGNAL", "AXLE_COUNTER_FAULT", "Axle Counter Fault Rectification", "SIGNAL_TELECOM", "S&T"),
    ("OVERHEAD_EQUIPMENT", "OHE_TENSION_ANOMALY", "OHE Tension Inspection", "TRACTION_DISTRIBUTION", "TRD"),
    ("OVERHEAD_EQUIPMENT", "INSULATOR_DAMAGE", "OHE Insulator Replacement", "TRACTION_DISTRIBUTION", "TRD"),
    ("TRACK", "RAIL_WELD_DEFECT", "Rail Weld Defect Repair", "TRACK_MAINTENANCE", "P-WAY"),
    ("TRACK", "SLEEPER_DAMAGE", "Sleeper Replacement", "CIVIL_TRACK", "ENGINEERING"),
    ("TRACK", "TURNOUT_WEAR", "Turnout Wear Inspection", "TRACK_MAINTENANCE", "P-WAY"),
    ("TRACK", "DRAINAGE_BLOCK", "Track Drainage Clearance", "CIVIL_TRACK", "ENGINEERING"),
    ("TRACK", "WATERLOGGING", "Waterlogging Response", "CIVIL_TRACK", "ENGINEERING"),
]

SEVERITY_WEIGHTS = [
    (FaultSeverity.CRITICAL, 0.10),
    (FaultSeverity.HIGH, 0.28),
    (FaultSeverity.MEDIUM, 0.42),
    (FaultSeverity.LOW, 0.20),
]

FIRST_NAMES = [
    "Arjun", "Priya", "Karthik", "Meena", "Rahul", "Asha", "Vivek", "Nandhini",
    "Sanjay", "Divya", "Ajay", "Rakesh", "Lakshmi", "Manoj", "Deepa", "Suresh",
    "Anitha", "Harish", "Keerthana", "Prakash", "Neha", "Varun", "Rohit", "Kavya",
]
LAST_NAMES = [
    "Kumar", "Raman", "Sharma", "Nair", "Patel", "Singh", "Babu", "Reddy",
    "Iyer", "Das", "Verma", "Pillai", "Rao", "Mishra", "Menon", "Gupta",
]


def weighted_choice(options):
    r = RNG.random()
    acc = 0.0
    for value, weight in options:
        acc += weight
        if r <= acc:
            return value
    return options[-1][0]


def point_wkt(lat, lon):
    return WKTElement(f"POINT({lon} {lat})", srid=4326)


def linestring_wkt(points):
    coords = ", ".join(f"{lon} {lat}" for lat, lon in points)
    return WKTElement(f"LINESTRING({coords})", srid=4326)


def haversine_like_km(a_code, b_code):
    a = RAIL_NODES[a_code]
    b = RAIL_NODES[b_code]
    return math.hypot(a[1] - b[1], a[2] - b[2]) * 111.0


def build_graph():
    graph = {code: [] for code in RAIL_NODES}
    for a, b in RAIL_EDGES:
        w = haversine_like_km(a, b)
        graph[a].append((b, w))
        graph[b].append((a, w))
    return graph


RAIL_GRAPH = build_graph()


def shortest_path(start_code, end_code):
    import heapq

    pq = [(0.0, start_code, [start_code])]
    best = {}

    while pq:
        cost, node, path = heapq.heappop(pq)
        if node == end_code:
            return path
        if node in best and best[node] <= cost:
            continue
        best[node] = cost
        for nxt, weight in RAIL_GRAPH[node]:
            heapq.heappush(pq, (cost + weight, nxt, path + [nxt]))

    raise RuntimeError(f"No DEMO_REPLAY rail path between {start_code} and {end_code}")


def route_points(route_codes):
    return [(RAIL_NODES[c][1], RAIL_NODES[c][2]) for c in route_codes]


def route_length_km(route_codes):
    return round(
        sum(haversine_like_km(a, b) for a, b in zip(route_codes, route_codes[1:])),
        1,
    )


def sample_polyline(points, count):
    """Return count+1 evenly spaced points along a polyline."""
    if len(points) < 2:
        return points

    segment_lengths = []
    total = 0.0

    for a, b in zip(points, points[1:]):
        length = math.hypot(a[0] - b[0], a[1] - b[1])
        segment_lengths.append(length)
        total += length

    if total == 0:
        return [points[0]] * (count + 1)

    result = []
    for i in range(count + 1):
        target = total * (i / count)
        traversed = 0.0

        for idx, seg_len in enumerate(segment_lengths):
            if traversed + seg_len >= target or idx == len(segment_lengths) - 1:
                local = 0.0 if seg_len == 0 else (target - traversed) / seg_len
                a = points[idx]
                b = points[idx + 1]
                result.append((
                    interpolate(a[0], b[0], local),
                    interpolate(a[1], b[1], local),
                ))
                break

            traversed += seg_len

    return result


def interpolate(a, b, t):
    return a + (b - a) * t


def priority_from_severity(severity):
    ranges = {
        FaultSeverity.CRITICAL: (90.0, 99.9),
        FaultSeverity.HIGH: (75.0, 92.0),
        FaultSeverity.MEDIUM: (50.0, 78.0),
        FaultSeverity.LOW: (20.0, 55.0),
    }
    lo, hi = ranges[severity]
    return round(RNG.uniform(lo, hi), 1)


async def get_or_create_user(session, employee_id, full_name, role, zone, division, email):
    global PASSWORD_HASH

    result = await session.execute(select(User).where(User.employee_id == employee_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    if PASSWORD_HASH is None:
        PASSWORD_HASH = hash_password(PASSWORD)

    user = User(
        employee_id=employee_id,
        full_name=full_name,
        email=email,
        password_hash=PASSWORD_HASH,
        role=role,
        zone=zone,
        division=division,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def clear_operational_data(session):
    # PostgreSQL TRUNCATE is much faster than row-by-row DELETE for demo resets.
    from sqlalchemy import text

    await session.execute(text("""
        TRUNCATE TABLE
            route_alternatives,
            affected_trains,
            disruption_events,
            extension_requests,
            work_logs,
            worker_assignments,
            worker_attendance,
            worker_availability,
            worker_skills,
            worker_profiles,
            maintenance_jobs,
            fault_events,
            track_segments,
            railway_corridors
        RESTART IDENTITY CASCADE
    """))

    # Remove prior worker login accounts after operational FKs are cleared.
    await session.execute(
        delete(User).where(User.role == UserRole.WORKER)
    )
    await session.flush()


async def seed():
    async with AsyncSessionLocal() as session:
        print("RailSync large-scale seed starting...")
        print("Clearing old operational demo data...")
        await clear_operational_data(session)

        manager = await get_or_create_user(
            session,
            "MGR001",
            "RailSync Maintenance Manager",
            UserRole.MANAGER,
            "SR",
            "Chennai",
            "manager@railsync.local",
        )

        await get_or_create_user(
            session,
            "TOP001",
            "RailSync Train Operator",
            UserRole.TRAIN_OPERATOR,
            "SR",
            "Chennai",
            "operator@railsync.local",
        )

        # -----------------------
        # Corridors + routed segments
        # -----------------------
        corridors = []
        corridor_routes = {}

        zone_by_state = {
            "Tamil Nadu": ("SR", "Chennai"),
            "Kerala": ("SR", "Thiruvananthapuram"),
            "Karnataka": ("SWR", "Hubballi"),
            "Telangana": ("SCR", "Secunderabad"),
            "Andhra Pradesh": ("SCR", "Vijayawada"),
            "Odisha": ("SER", "Bhubaneswar"),
            "West Bengal": ("ER", "Howrah"),
            "Maharashtra": ("CR", "Mumbai"),
            "Gujarat": ("WR", "Ahmedabad"),
            "Rajasthan": ("NWR", "Jaipur"),
            "Delhi": ("NR", "Delhi"),
            "Uttar Pradesh": ("NR", "Lucknow"),
            "Bihar": ("ECR", "Patna"),
        }

        for idx, (start_code, end_code) in enumerate(CORRIDOR_PAIRS[:TARGET_CORRIDORS]):
            route_codes = shortest_path(start_code, end_code)
            pts = route_points(route_codes)

            start = RAIL_NODES[start_code]
            end = RAIL_NODES[end_code]
            zone, division = zone_by_state.get(start[3], ("IR", start[0]))

            code = (
                "COR-SR-MAS-TBM"
                if idx == 0
                else f"COR-{idx+1:03d}-{start_code}-{end_code}"
            )

            corridor = RailwayCorridor(
                corridor_code=code,
                name=f"{start[0]} - {end[0]}",
                zone=zone,
                division=division,
                start_station_code=start_code,
                start_station_name=start[0],
                end_station_code=end_code,
                end_station_name=end[0],
                state_from=start[3],
                state_to=end[3],
                total_length_km=route_length_km(route_codes),
                geometry=linestring_wkt(pts),
                is_active=True,
            )
            session.add(corridor)
            await session.flush()

            corridors.append(corridor)
            corridor_routes[corridor.id] = route_codes

        print(f"  ✓ Corridors created: {len(corridors)}")

        # -----------------------
        # Segments: exactly 1000
        # -----------------------
        segments = []
        per_corridor = TARGET_SEGMENTS // TARGET_CORRIDORS

        for c_idx, corridor in enumerate(corridors):
            route_codes = corridor_routes[corridor.id]
            pts = route_points(route_codes)
            sampled = sample_polyline(pts, per_corridor)

            for s_idx in range(per_corridor):
                lat1, lon1 = sampled[s_idx]
                lat2, lon2 = sampled[s_idx + 1]

                seg = TrackSegment(
                    corridor_id=corridor.id,
                    segment_code=f"SEG-{c_idx+1:03d}-{s_idx+1:02d}",
                    name=f"{corridor.name} Segment {s_idx+1}",
                    from_station_code=corridor.start_station_code,
                    from_station_name=corridor.start_station_name,
                    to_station_code=corridor.end_station_code,
                    to_station_name=corridor.end_station_name,
                    line_name=corridor.name,
                    track_number=str((s_idx % 4) + 1),
                    direction="UP" if s_idx % 2 == 0 else "DOWN",
                    electrified=True,
                    max_speed_kmph=RNG.choice([80, 90, 100, 110, 120, 130]),
                    length_km=round((corridor.total_length_km or 100.0) / per_corridor, 2),
                    geometry=linestring_wkt([(lat1, lon1), (lat2, lon2)]),
                    is_active=True,
                )
                # These temporary coordinates are used by the synthetic job generator.
                seg._seed_lat1 = lat1
                seg._seed_lon1 = lon1
                seg._seed_lat2 = lat2
                seg._seed_lon2 = lon2

                session.add(seg)
                segments.append(seg)

        await session.flush()
        print(f"  ✓ Track segments created: {len(segments)}")

        # -----------------------
        # Workers
        # -----------------------
        workers = []
        worker_pool = {}

        fixed_workers = [
            ("WRK001", "Arjun Kumar", "TRACK_MAINTENANCE", "P-WAY", "ENGINEERING", WorkerAvailabilityStatus.AVAILABLE),
            ("WRK002", "Priya Raman", "TRACK_MAINTENANCE", "P-WAY", "ENGINEERING", WorkerAvailabilityStatus.AVAILABLE),
            ("WRK003", "Karthik S", "SIGNAL_TELECOM", "S&T", "SIGNAL", WorkerAvailabilityStatus.AVAILABLE),
            ("WRK004", "Meena R", "SIGNAL_TELECOM", "S&T", "SIGNAL", WorkerAvailabilityStatus.PARTIAL),
            ("WRK005", "Rahul Verma", "TRACTION_DISTRIBUTION", "TRD", "ELECTRICAL", WorkerAvailabilityStatus.AVAILABLE),
        ]

        for idx in range(TARGET_WORKERS):
            if idx < len(fixed_workers):
                employee_id, full_name, skill, authority, dept, availability = fixed_workers[idx]
                zone = "SR"
                division = "Chennai"
                station_code = "TBM" if idx < 2 else "MAS"
                station = RAIL_NODES[station_code]
            else:
                employee_id = f"WRK{idx+1:03d}"
                full_name = f"{RNG.choice(FIRST_NAMES)} {RNG.choice(LAST_NAMES)}"
                skill, _, authority, dept = RNG.choice(SKILL_PROFILES)
                zone_info = RNG.choice(ZONES)
                zone = zone_info[0]
                division = zone_info[2]
                station_code = RNG.choice(list(RAIL_NODES.keys()))
                station = RAIL_NODES[station_code]
                availability = weighted_choice([
                    (WorkerAvailabilityStatus.AVAILABLE, 0.66),
                    (WorkerAvailabilityStatus.PARTIAL, 0.20),
                    (WorkerAvailabilityStatus.UNAVAILABLE, 0.14),
                ])

            user = await get_or_create_user(
                session,
                employee_id,
                full_name,
                UserRole.WORKER,
                zone,
                division,
                f"{employee_id.lower()}@railsync.local",
            )

            profile = WorkerProfile(
                user_id=user.id,
                employee_code=employee_id,
                designation=RNG.choice([
                    "Senior Track Maintainer",
                    "Technician",
                    "Junior Engineer",
                    "Section Maintainer",
                    "Maintenance Technician",
                ]),
                department=dept,
                railway_zone=zone,
                division=division,
                home_station_code=station_code,
                home_station_name=station[0],
                current_location=point_wkt(station[1] + RNG.uniform(-0.015, 0.015), station[2] + RNG.uniform(-0.015, 0.015)),
                years_experience=round(RNG.uniform(1, 24), 1),
                max_daily_minutes=360,
                is_active=True,
            )
            session.add(profile)
            await session.flush()
            workers.append(profile)

            primary_skill = next((x for x in SKILL_PROFILES if x[0] == skill), SKILL_PROFILES[0])
            session.add(WorkerSkill(
                worker_id=profile.id,
                skill_code=primary_skill[0],
                skill_name=primary_skill[1],
                authority_code=primary_skill[2],
                proficiency_level=RNG.randint(3, 5) if idx < 5 else RNG.randint(1, 5),
                certification_expiry=date.today() + timedelta(days=RNG.randint(90, 900)),
                is_certified=True,
            ))

            worker_pool.setdefault(
                (primary_skill[0], primary_skill[2]),
                [],
            ).append(profile)

            # Some workers get a second skill for realistic overlap.
            if RNG.random() < 0.55:
                secondary = RNG.choice([x for x in SKILL_PROFILES if x[0] != primary_skill[0]])
                secondary_certified = RNG.random() > 0.05
                session.add(WorkerSkill(
                    worker_id=profile.id,
                    skill_code=secondary[0],
                    skill_name=secondary[1],
                    authority_code=secondary[2],
                    proficiency_level=RNG.randint(1, 4),
                    certification_expiry=date.today() + timedelta(days=RNG.randint(60, 700)),
                    is_certified=secondary_certified,
                ))
                if secondary_certified:
                    worker_pool.setdefault(
                        (secondary[0], secondary[2]),
                        [],
                    ).append(profile)

            available_until = NOW + timedelta(hours=RNG.randint(2, 8))
            session.add(WorkerAvailability(
                worker_id=profile.id,
                status=availability,
                available_from=NOW - timedelta(minutes=RNG.randint(0, 120)),
                available_until=available_until,
                reason=None if availability != WorkerAvailabilityStatus.UNAVAILABLE else RNG.choice([
                    "Already allocated to field work",
                    "Rest period",
                    "Training",
                    "Leave",
                ]),
            ))

            attendance_status = AttendanceStatus.PRESENT
            if availability == WorkerAvailabilityStatus.PARTIAL:
                attendance_status = AttendanceStatus.PARTIAL
            elif availability == WorkerAvailabilityStatus.UNAVAILABLE:
                attendance_status = RNG.choice([AttendanceStatus.ABSENT, AttendanceStatus.LEAVE])

            session.add(WorkerAttendance(
                worker_id=profile.id,
                attendance_date=date.today(),
                status=attendance_status,
                shift_start=time(8, 0),
                shift_end=time(16, 0),
                checked_in_at=NOW - timedelta(hours=RNG.randint(1, 5)) if attendance_status in [AttendanceStatus.PRESENT, AttendanceStatus.PARTIAL] else None,
                checked_out_at=None,
            ))

        await session.flush()
        print(f"  ✓ Workers created: {len(workers)}")

        # -----------------------
        # Faults + maintenance jobs
        # -----------------------
        jobs = []

        for idx in range(TARGET_JOBS):
            seg = segments[idx % len(segments)] if idx < 1000 else RNG.choice(segments)
            corridor = next(c for c in corridors if c.id == seg.corridor_id)

            # deterministic judge scenario
            if idx == 0:
                template = JOB_TEMPLATES[0]
                severity = FaultSeverity.CRITICAL
                job_code = "JOB-TBM-001"
                fault_code = "FLT-TBM-001"
                lat, lon = 12.9360, 80.1368
                km_marker = 14.8
                priority = 97.2
                estimated_minutes = 90
                title = "Rail Crack Inspection and Repair"
                description = "Suspected transverse rail crack detected on UP main line near Tambaram."
                skill, authority = "TRACK_MAINTENANCE", "P-WAY"
                asset_type, fault_type = "TRACK", "RAIL_CRACK"
                planned_start = NOW + timedelta(minutes=30)
            else:
                asset_type, fault_type, title, skill, authority = RNG.choice(JOB_TEMPLATES)
                severity = weighted_choice(SEVERITY_WEIGHTS)
                job_code = f"JOB-{idx+1:05d}"
                fault_code = f"FLT-{idx+1:05d}"
                t = RNG.random()
                lat = interpolate(seg._seed_lat1, seg._seed_lat2, t)
                lon = interpolate(seg._seed_lon1, seg._seed_lon2, t)
                km_marker = round(RNG.uniform(0.1, max(corridor.total_length_km or 100, 1)), 1)
                priority = priority_from_severity(severity)
                estimated_minutes = RNG.randint(30, 180)
                description = f"{title} detected on {corridor.name}; requires field inspection and maintenance action."
                planned_start = NOW + timedelta(minutes=RNG.randint(-360, 1440))

            safety_critical = severity == FaultSeverity.CRITICAL or (severity == FaultSeverity.HIGH and RNG.random() < 0.35)
            detection_confidence = round(RNG.uniform(0.72, 0.99), 3)

            fault = FaultEvent(
                fault_code=fault_code,
                track_segment_id=seg.id,
                asset_type=asset_type,
                fault_type=fault_type,
                description=description,
                severity=severity,
                status=FaultStatus.JOB_CREATED,
                location=point_wkt(lat, lon),
                km_marker=km_marker,
                detected_source=RNG.choice(["TMS", "SMMS", "TDMS", "FIELD_INSPECTION", "SENSOR"]),
                detection_confidence=detection_confidence,
                safety_critical=safety_critical,
                metadata_json={"data_mode": "DEMO_REPLAY", "generator": "RailSync"},
                detected_at=NOW - timedelta(minutes=RNG.randint(5, 7200)),
                verified_at=NOW - timedelta(minutes=RNG.randint(1, 240)),
            )
            session.add(fault)
            await session.flush()

            # Mostly open/current jobs with a smaller historical tail.
            r = RNG.random()
            if idx == 0:
                status = JobStatus.READY_FOR_ASSIGNMENT
            elif r < 0.60:
                status = JobStatus.READY_FOR_ASSIGNMENT
            elif r < 0.72:
                status = JobStatus.ASSIGNED
            elif r < 0.84:
                status = JobStatus.IN_PROGRESS
            elif r < 0.88:
                status = JobStatus.PAUSED
            elif r < 0.94:
                status = JobStatus.COMPLETED
            elif r < 0.97:
                status = JobStatus.EXTENSION_REQUESTED
            else:
                status = JobStatus.PENDING

            failure_risk = round(min(0.99, max(0.05, priority / 100 + RNG.uniform(-0.15, 0.10))), 3)
            train_impact = max(0, int((priority / 100) * RNG.randint(2, 18)))
            delay_est = round(max(0, (priority / 100) * RNG.uniform(4, 35)), 1)

            planned_end = planned_start + timedelta(minutes=estimated_minutes)

            job = MaintenanceJob(
                job_code=job_code,
                fault_id=fault.id,
                track_segment_id=seg.id,
                title=title,
                description=description,
                asset_type=asset_type,
                job_type=fault_type,
                required_skill=skill,
                required_authority=authority,
                severity=severity,
                status=status,
                location=point_wkt(lat, lon),
                km_marker=km_marker,
                estimated_minutes=estimated_minutes,
                priority_score=priority,
                priority_reason=f"{severity.value} severity; predicted safety/traffic impact requires ranked maintenance attention.",
                predicted_failure_risk=failure_risk,
                expected_train_impact=train_impact,
                estimated_delay_minutes=delay_est,
                block_required=(severity != FaultSeverity.LOW or RNG.random() < 0.65),
                planned_start=planned_start,
                planned_end=planned_end,
                actual_start=(NOW - timedelta(minutes=RNG.randint(10, 120))) if status in [JobStatus.IN_PROGRESS, JobStatus.PAUSED, JobStatus.COMPLETED, JobStatus.EXTENSION_REQUESTED] else None,
                actual_end=(NOW - timedelta(minutes=RNG.randint(1, 30))) if status == JobStatus.COMPLETED else None,
                created_by_user_id=manager.id,
            )
            session.add(job)
            await session.flush()
            jobs.append(job)

            if (idx + 1) % 250 == 0:
                print(f"  ... maintenance jobs prepared: {idx + 1}/{TARGET_JOBS}")

        print(f"  ✓ Maintenance jobs created: {len(jobs)}")

        # -----------------------
        # Assignments & work logs
        # -----------------------
        assignment_count = 0
        extension_count = 0

        # Current/historical assignments for non-ready jobs.
        assignable_jobs = [j for j in jobs if j.status in [
            JobStatus.ASSIGNED,
            JobStatus.IN_PROGRESS,
            JobStatus.PAUSED,
            JobStatus.COMPLETED,
            JobStatus.EXTENSION_REQUESTED,
        ]]

        for job in assignable_jobs[:500]:
            candidates = worker_pool.get(
                (job.required_skill, job.required_authority),
                [],
            )

            if not candidates:
                continue

            worker = RNG.choice(candidates)
            suitability = round(RNG.uniform(0.62, 0.97), 3)

            if job.status == JobStatus.ASSIGNED:
                a_status = AssignmentStatus.ASSIGNED
                progress = 0
            elif job.status == JobStatus.IN_PROGRESS:
                a_status = AssignmentStatus.IN_PROGRESS
                progress = RNG.randint(10, 80)
            elif job.status == JobStatus.PAUSED:
                a_status = AssignmentStatus.PAUSED
                progress = RNG.randint(20, 75)
            elif job.status == JobStatus.COMPLETED:
                a_status = AssignmentStatus.COMPLETED
                progress = 100
            else:
                a_status = AssignmentStatus.IN_PROGRESS
                progress = RNG.randint(45, 90)

            assignment = WorkerAssignment(
                maintenance_job_id=job.id,
                worker_id=worker.id,
                assigned_by_user_id=manager.id,
                status=a_status,
                suitability_score=suitability,
                suitability_reason="Skill/authority matched; availability, experience and workload used for suitability ranking.",
                assigned_at=NOW - timedelta(minutes=RNG.randint(10, 1440)),
                accepted_at=NOW - timedelta(minutes=RNG.randint(5, 600)),
                started_at=NOW - timedelta(minutes=RNG.randint(5, 360)) if a_status in [AssignmentStatus.IN_PROGRESS, AssignmentStatus.PAUSED, AssignmentStatus.COMPLETED] else None,
                paused_at=NOW - timedelta(minutes=RNG.randint(1, 60)) if a_status == AssignmentStatus.PAUSED else None,
                completed_at=NOW - timedelta(minutes=RNG.randint(1, 120)) if a_status == AssignmentStatus.COMPLETED else None,
                progress_percent=progress,
            )
            session.add(assignment)
            await session.flush()
            assignment_count += 1

            session.add(WorkLog(
                maintenance_job_id=job.id,
                assignment_id=assignment.id,
                worker_id=worker.id,
                action="ASSIGNED",
                message=f"Job assigned with suitability score {suitability:.2f}.",
                progress_percent=0,
            ))
            if progress > 0:
                session.add(WorkLog(
                    maintenance_job_id=job.id,
                    assignment_id=assignment.id,
                    worker_id=worker.id,
                    action="PROGRESS_UPDATED",
                    message="Field progress synchronized to RailSync.",
                    progress_percent=progress,
                ))
            if progress == 100:
                session.add(WorkLog(
                    maintenance_job_id=job.id,
                    assignment_id=assignment.id,
                    worker_id=worker.id,
                    action="COMPLETED",
                    message="Maintenance work completed.",
                    progress_percent=100,
                ))

            if job.status == JobStatus.EXTENSION_REQUESTED and extension_count < 40:
                session.add(ExtensionRequest(
                    maintenance_job_id=job.id,
                    assignment_id=assignment.id,
                    worker_id=worker.id,
                    requested_minutes=RNG.choice([15, 20, 30, 45, 60]),
                    reason=RNG.choice([
                        "Additional inspection required after opening the asset.",
                        "Replacement component installation requires more time.",
                        "Site access and safety clearance delayed progress.",
                        "Unexpected secondary defect found during maintenance.",
                    ]),
                    status=ExtensionStatus.PENDING,
                ))
                extension_count += 1

        # -----------------------
        # Disruptions / alternatives
        # -----------------------
        # We only create the disruption records here. Train links can be enriched
        # later by the live/demo-replay train-position service.
        disruption_jobs = sorted(
            [j for j in jobs if j.severity in [FaultSeverity.CRITICAL, FaultSeverity.HIGH]],
            key=lambda j: j.priority_score or 0,
            reverse=True,
        )[:80]

        for idx, job in enumerate(disruption_jobs):
            disruption = DisruptionEvent(
                disruption_code=f"DIS-{idx+1:04d}",
                maintenance_job_id=job.id,
                track_segment_id=job.track_segment_id,
                status=RNG.choice([DisruptionStatus.OPEN, DisruptionStatus.EVALUATING]),
                reason=f"Maintenance block impact from {job.job_code}: {job.title}",
                expected_start=job.planned_start,
                expected_end=job.planned_end,
                estimated_delay_minutes=job.estimated_delay_minutes,
                severity=job.severity,
            )
            session.add(disruption)
            await session.flush()

            for alt_idx, action in enumerate([
                ("HOLD_TRAIN", "Hold approaching train before block"),
                ("SHIFT_BLOCK", "Shift maintenance block start"),
                ("SPEED_RESTRICTION", "Apply temporary speed restriction"),
            ], start=1):
                delay = max(1.0, (job.estimated_delay_minutes or 5.0) * RNG.uniform(0.45, 1.15))
                feasibility = round(RNG.uniform(0.55, 0.98), 3)
                ml_rank = round(feasibility * 0.65 + (1 / (1 + delay)) * 0.35, 3)
                session.add(RouteAlternative(
                    disruption_id=disruption.id,
                    alternative_code=f"ALT-{idx+1:04d}-{alt_idx}",
                    action_type=action[0],
                    title=action[1],
                    description="Generated operational alternative for RailSync demo planning.",
                    route_geometry=None,
                    predicted_delay_minutes=round(delay, 1),
                    predicted_cost=round(RNG.uniform(1000, 25000), 2),
                    conflict_count=RNG.randint(0, 4),
                    feasibility_score=feasibility,
                    ml_rank_score=ml_rank,
                    is_feasible=True,
                    status=AlternativeStatus.RECOMMENDED if alt_idx == 1 else AlternativeStatus.GENERATED,
                    generated_reason="Ranked using delay, conflicts and operational feasibility.",
                ))

        await session.commit()

        print()
        print("RailSync large-scale seed COMPLETE")
        print(f"Corridors:          {len(corridors)}")
        print(f"Track segments:     {len(segments)}")
        print(f"Workers:            {len(workers)}")
        print(f"Maintenance jobs:   {len(jobs)}")
        print(f"Assignments:        {assignment_count}")
        print(f"Extension requests: {extension_count}")
        print(f"Disruptions:        {len(disruption_jobs)}")
        print()
        print("Judge accounts:")
        print("MGR001 / RailSync@123")
        print("WRK001 / RailSync@123")
        print("WRK002 / RailSync@123")
        print("WRK003 / RailSync@123")
        print("WRK004 / RailSync@123")
        print("WRK005 / RailSync@123")
        print("TOP001 / RailSync@123")


if __name__ == "__main__":
    asyncio.run(seed())
