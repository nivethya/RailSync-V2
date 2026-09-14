import asyncio
from datetime import datetime, timedelta, timezone

from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.operations import (
    FaultEvent,
    FaultSeverity,
    FaultStatus,
    JobStatus,
    MaintenanceJob,
    RailwayCorridor,
    TrackSegment,
    WorkerAvailability,
    WorkerAvailabilityStatus,
    WorkerProfile,
    WorkerSkill,
)
from app.models.user import User


def point_wkt(lat: float, lon: float):
    return WKTElement(
        f"POINT({lon} {lat})",
        srid=4326,
    )


def line_wkt(points):
    coords = ", ".join(
        f"{lon} {lat}"
        for lat, lon in points
    )

    return WKTElement(
        f"LINESTRING({coords})",
        srid=4326,
    )


async def get_user_by_email(session, email: str):
    result = await session.execute(
        select(User).where(
            User.email == email
        )
    )

    return result.scalar_one_or_none()


async def main():
    async with AsyncSessionLocal() as session:

        # =====================================================
        # CLEAR ONLY DEMO OPERATIONAL DATA
        # =====================================================

        # Keep auth users intact.
        for model in [
            WorkerAvailability,
            WorkerSkill,
            WorkerProfile,
            MaintenanceJob,
            FaultEvent,
            TrackSegment,
            RailwayCorridor,
        ]:
            result = await session.execute(
                select(model)
            )

            for row in result.scalars().all():
                await session.delete(row)

        await session.flush()

        # =====================================================
        # RAILWAY CORRIDORS
        # =====================================================

        corridors = []

        corridor_data = [
            {
                "corridor_code": "SR-MAS-TBM",
                "name": "Chennai Central - Tambaram",
                "zone": "Southern Railway",
                "division": "Chennai",
                "start_station_code": "MAS",
                "start_station_name": "MGR Chennai Central",
                "end_station_code": "TBM",
                "end_station_name": "Tambaram",
                "state_from": "Tamil Nadu",
                "state_to": "Tamil Nadu",
                "total_length_km": 28.0,
                "points": [
                    (13.0827, 80.2707),
                    (13.0604, 80.2496),
                    (13.0067, 80.2206),
                    (12.9823, 80.1888),
                    (12.9249, 80.1275),
                ],
            },
            {
                "corridor_code": "SR-TBM-CGL",
                "name": "Tambaram - Chengalpattu",
                "zone": "Southern Railway",
                "division": "Chennai",
                "start_station_code": "TBM",
                "start_station_name": "Tambaram",
                "end_station_code": "CGL",
                "end_station_name": "Chengalpattu",
                "state_from": "Tamil Nadu",
                "state_to": "Tamil Nadu",
                "total_length_km": 31.0,
                "points": [
                    (12.9249, 80.1275),
                    (12.8557, 80.0734),
                    (12.7947, 80.0259),
                    (12.6925, 79.9759),
                ],
            },
            {
                "corridor_code": "SR-MAS-AJJ",
                "name": "Chennai - Arakkonam",
                "zone": "Southern Railway",
                "division": "Chennai",
                "start_station_code": "MAS",
                "start_station_name": "MGR Chennai Central",
                "end_station_code": "AJJ",
                "end_station_name": "Arakkonam Junction",
                "state_from": "Tamil Nadu",
                "state_to": "Tamil Nadu",
                "total_length_km": 69.0,
                "points": [
                    (13.0827, 80.2707),
                    (13.1150, 80.2060),
                    (13.1230, 80.1090),
                    (13.1220, 79.9140),
                    (13.0840, 79.6710),
                ],
            },
            {
                "corridor_code": "SR-MAS-TVC",
                "name": "Chennai - Thiruvananthapuram",
                "zone": "Southern Railway",
                "division": "Chennai / Madurai / Thiruvananthapuram",
                "start_station_code": "MAS",
                "start_station_name": "Chennai",
                "end_station_code": "TVC",
                "end_station_name": "Thiruvananthapuram Central",
                "state_from": "Tamil Nadu",
                "state_to": "Kerala",
                "total_length_km": 790.0,
                "points": [
                    (13.0827, 80.2707),
                    (12.6925, 79.9759),
                    (10.7905, 78.7047),
                    (9.9252, 78.1198),
                    (8.7139, 77.7567),
                    (8.4875, 76.9525),
                ],
            },
            {
                "corridor_code": "SWR-SBC-MYS",
                "name": "Bengaluru - Mysuru",
                "zone": "South Western Railway",
                "division": "Bengaluru",
                "start_station_code": "SBC",
                "start_station_name": "KSR Bengaluru",
                "end_station_code": "MYS",
                "end_station_name": "Mysuru Junction",
                "state_from": "Karnataka",
                "state_to": "Karnataka",
                "total_length_km": 139.0,
                "points": [
                    (12.9784, 77.5725),
                    (12.7400, 77.4960),
                    (12.5200, 77.2000),
                    (12.2958, 76.6394),
                ],
            },
            {
                "corridor_code": "CR-CSMT-PUNE",
                "name": "Mumbai CSMT - Pune",
                "zone": "Central Railway",
                "division": "Mumbai",
                "start_station_code": "CSMT",
                "start_station_name": "Mumbai CSMT",
                "end_station_code": "PUNE",
                "end_station_name": "Pune Junction",
                "state_from": "Maharashtra",
                "state_to": "Maharashtra",
                "total_length_km": 192.0,
                "points": [
                    (18.9402, 72.8356),
                    (19.0330, 73.0297),
                    (18.7480, 73.4070),
                    (18.5204, 73.8567),
                ],
            },
            {
                "corridor_code": "NR-NDLS-CNB",
                "name": "New Delhi - Kanpur",
                "zone": "Northern Railway",
                "division": "Delhi",
                "start_station_code": "NDLS",
                "start_station_name": "New Delhi",
                "end_station_code": "CNB",
                "end_station_name": "Kanpur Central",
                "state_from": "Delhi",
                "state_to": "Uttar Pradesh",
                "total_length_km": 440.0,
                "points": [
                    (28.6430, 77.2197),
                    (28.1200, 78.1000),
                    (27.1767, 78.0081),
                    (26.4499, 80.3319),
                ],
            },
            {
                "corridor_code": "ER-HWH-ASN",
                "name": "Howrah - Asansol",
                "zone": "Eastern Railway",
                "division": "Howrah",
                "start_station_code": "HWH",
                "start_station_name": "Howrah Junction",
                "end_station_code": "ASN",
                "end_station_name": "Asansol Junction",
                "state_from": "West Bengal",
                "state_to": "West Bengal",
                "total_length_km": 200.0,
                "points": [
                    (22.5839, 88.3420),
                    (23.2324, 87.8615),
                    (23.6739, 86.9524),
                ],
            },
        ]

        for item in corridor_data:
            corridor = RailwayCorridor(
                corridor_code=item["corridor_code"],
                name=item["name"],
                zone=item["zone"],
                division=item["division"],
                start_station_code=item["start_station_code"],
                start_station_name=item["start_station_name"],
                end_station_code=item["end_station_code"],
                end_station_name=item["end_station_name"],
                state_from=item["state_from"],
                state_to=item["state_to"],
                total_length_km=item["total_length_km"],
                geometry=line_wkt(
                    item["points"]
                ),
                is_active=True,
            )

            session.add(corridor)

            corridors.append(
                corridor
            )

        await session.flush()

        corridor_by_code = {
            corridor.corridor_code: corridor
            for corridor in corridors
        }

        # =====================================================
        # TRACK SEGMENTS
        # =====================================================

        segment_data = [
            {
                "segment_code": "SEG-MAS-MBM",
                "corridor": "SR-MAS-TBM",
                "name": "Chennai Central - Mambalam",
                "from_code": "MAS",
                "from_name": "Chennai Central",
                "to_code": "MBM",
                "to_name": "Mambalam",
                "track_number": "UP MAIN",
                "direction": "UP",
                "length_km": 9.0,
                "points": [
                    (13.0827, 80.2707),
                    (13.0340, 80.2340),
                ],
            },
            {
                "segment_code": "SEG-MBM-CMP",
                "corridor": "SR-MAS-TBM",
                "name": "Mambalam - Chromepet",
                "from_code": "MBM",
                "from_name": "Mambalam",
                "to_code": "CMP",
                "to_name": "Chromepet",
                "track_number": "DOWN MAIN",
                "direction": "DOWN",
                "length_km": 14.0,
                "points": [
                    (13.0340, 80.2340),
                    (12.9516, 80.1462),
                ],
            },
            {
                "segment_code": "SEG-CMP-TBM",
                "corridor": "SR-MAS-TBM",
                "name": "Chromepet - Tambaram",
                "from_code": "CMP",
                "from_name": "Chromepet",
                "to_code": "TBM",
                "to_name": "Tambaram",
                "track_number": "UP MAIN",
                "direction": "UP",
                "length_km": 6.0,
                "points": [
                    (12.9516, 80.1462),
                    (12.9249, 80.1275),
                ],
            },
            {
                "segment_code": "SEG-TBM-GI",
                "corridor": "SR-TBM-CGL",
                "name": "Tambaram - Guduvancheri",
                "from_code": "TBM",
                "from_name": "Tambaram",
                "to_code": "GI",
                "to_name": "Guduvancheri",
                "track_number": "UP MAIN",
                "direction": "UP",
                "length_km": 18.0,
                "points": [
                    (12.9249, 80.1275),
                    (12.8435, 80.0601),
                ],
            },
            {
                "segment_code": "SEG-GI-CGL",
                "corridor": "SR-TBM-CGL",
                "name": "Guduvancheri - Chengalpattu",
                "from_code": "GI",
                "from_name": "Guduvancheri",
                "to_code": "CGL",
                "to_name": "Chengalpattu",
                "track_number": "DOWN MAIN",
                "direction": "DOWN",
                "length_km": 23.0,
                "points": [
                    (12.8435, 80.0601),
                    (12.6925, 79.9759),
                ],
            },
            {
                "segment_code": "SEG-SBC-BID",
                "corridor": "SWR-SBC-MYS",
                "name": "Bengaluru - Bidadi",
                "from_code": "SBC",
                "from_name": "Bengaluru",
                "to_code": "BID",
                "to_name": "Bidadi",
                "track_number": "MAIN",
                "direction": "BOTH",
                "length_km": 32.0,
                "points": [
                    (12.9784, 77.5725),
                    (12.7983, 77.3861),
                ],
            },
            {
                "segment_code": "SEG-CSMT-KYN",
                "corridor": "CR-CSMT-PUNE",
                "name": "Mumbai CSMT - Kalyan",
                "from_code": "CSMT",
                "from_name": "Mumbai CSMT",
                "to_code": "KYN",
                "to_name": "Kalyan",
                "track_number": "MAIN",
                "direction": "BOTH",
                "length_km": 54.0,
                "points": [
                    (18.9402, 72.8356),
                    (19.2403, 73.1305),
                ],
            },
            {
                "segment_code": "SEG-NDLS-AGC",
                "corridor": "NR-NDLS-CNB",
                "name": "New Delhi - Agra",
                "from_code": "NDLS",
                "from_name": "New Delhi",
                "to_code": "AGC",
                "to_name": "Agra Cantt",
                "track_number": "MAIN",
                "direction": "BOTH",
                "length_km": 195.0,
                "points": [
                    (28.6430, 77.2197),
                    (27.1767, 78.0081),
                ],
            },
            {
                "segment_code": "SEG-HWH-BWN",
                "corridor": "ER-HWH-ASN",
                "name": "Howrah - Barddhaman",
                "from_code": "HWH",
                "from_name": "Howrah",
                "to_code": "BWN",
                "to_name": "Barddhaman",
                "track_number": "MAIN",
                "direction": "BOTH",
                "length_km": 95.0,
                "points": [
                    (22.5839, 88.3420),
                    (23.2324, 87.8615),
                ],
            },
        ]

        segments = []

        for item in segment_data:
            segment = TrackSegment(
                corridor_id=
                    corridor_by_code[
                        item["corridor"]
                    ].id,
                segment_code=
                    item["segment_code"],
                name=
                    item["name"],
                from_station_code=
                    item["from_code"],
                from_station_name=
                    item["from_name"],
                to_station_code=
                    item["to_code"],
                to_station_name=
                    item["to_name"],
                line_name=
                    item["name"],
                track_number=
                    item["track_number"],
                direction=
                    item["direction"],
                electrified=True,
                max_speed_kmph=110,
                length_km=
                    item["length_km"],
                geometry=line_wkt(
                    item["points"]
                ),
                is_active=True,
            )

            session.add(segment)

            segments.append(segment)

        await session.flush()

        segment_by_code = {
            segment.segment_code: segment
            for segment in segments
        }

        # =====================================================
        # FAULTS + MAINTENANCE JOBS
        # =====================================================

        now = datetime.now(
            timezone.utc
        )

        jobs = [
            {
                "fault_code": "FLT-TBM-001",
                "job_code": "JOB-TBM-001",
                "segment": "SEG-CMP-TBM",
                "lat": 12.9360,
                "lon": 80.1368,
                "asset": "TRACK",
                "fault_type": "RAIL_CRACK",
                "title": "Rail Crack Inspection and Repair",
                "description": "Suspected transverse rail crack detected on UP main line.",
                "severity": FaultSeverity.CRITICAL,
                "skill": "TRACK_MAINTENANCE",
                "authority": "P-WAY",
                "estimated_minutes": 90,
                "priority_score": 97.2,
                "priority_reason": "Safety critical rail defect on high-density suburban corridor.",
                "failure_risk": 0.94,
                "train_impact": 8,
                "delay_minutes": 28,
                "km": 14.8,
            },
            {
                "fault_code": "FLT-TBM-002",
                "job_code": "JOB-TBM-002",
                "segment": "SEG-CMP-TBM",
                "lat": 12.9298,
                "lon": 80.1316,
                "asset": "TRACK",
                "fault_type": "FASTENER_DEFECT",
                "title": "Fastener Replacement",
                "description": "Multiple loose rail fasteners detected near Tambaram approach.",
                "severity": FaultSeverity.HIGH,
                "skill": "TRACK_MAINTENANCE",
                "authority": "P-WAY",
                "estimated_minutes": 55,
                "priority_score": 86.5,
                "priority_reason": "High vibration risk and commuter traffic density.",
                "failure_risk": 0.72,
                "train_impact": 4,
                "delay_minutes": 14,
                "km": 16.1,
            },
            {
                "fault_code": "FLT-MAS-001",
                "job_code": "JOB-MAS-001",
                "segment": "SEG-MAS-MBM",
                "lat": 13.0660,
                "lon": 80.2530,
                "asset": "SIGNAL",
                "fault_type": "SIGNAL_CABLE_DEGRADATION",
                "title": "Signal Cable Condition Check",
                "description": "Signal cable insulation degradation detected.",
                "severity": FaultSeverity.HIGH,
                "skill": "SIGNAL_TELECOM",
                "authority": "S&T",
                "estimated_minutes": 70,
                "priority_score": 83.0,
                "priority_reason": "Possible signalling reliability impact.",
                "failure_risk": 0.67,
                "train_impact": 6,
                "delay_minutes": 18,
                "km": 4.4,
            },
            {
                "fault_code": "FLT-CGL-001",
                "job_code": "JOB-CGL-001",
                "segment": "SEG-GI-CGL",
                "lat": 12.7560,
                "lon": 80.0040,
                "asset": "TRACK",
                "fault_type": "BALLAST_DEGRADATION",
                "title": "Ballast Profile Restoration",
                "description": "Reduced ballast shoulder profile on down main line.",
                "severity": FaultSeverity.MEDIUM,
                "skill": "TRACK_MAINTENANCE",
                "authority": "P-WAY",
                "estimated_minutes": 100,
                "priority_score": 64.2,
                "priority_reason": "Track geometry degradation risk if left untreated.",
                "failure_risk": 0.43,
                "train_impact": 2,
                "delay_minutes": 7,
                "km": 24.2,
            },
            {
                "fault_code": "FLT-BLR-001",
                "job_code": "JOB-BLR-001",
                "segment": "SEG-SBC-BID",
                "lat": 12.8790,
                "lon": 77.4750,
                "asset": "TRACK",
                "fault_type": "TRACK_ALIGNMENT",
                "title": "Track Alignment Correction",
                "description": "Alignment variation exceeds maintenance threshold.",
                "severity": FaultSeverity.HIGH,
                "skill": "TRACK_MAINTENANCE",
                "authority": "P-WAY",
                "estimated_minutes": 85,
                "priority_score": 79.5,
                "priority_reason": "Main corridor alignment deviation.",
                "failure_risk": 0.62,
                "train_impact": 5,
                "delay_minutes": 15,
                "km": 18.0,
            },
            {
                "fault_code": "FLT-MUM-001",
                "job_code": "JOB-MUM-001",
                "segment": "SEG-CSMT-KYN",
                "lat": 19.0740,
                "lon": 72.9980,
                "asset": "POINT_MACHINE",
                "fault_type": "POINT_MACHINE_FAILURE",
                "title": "Point Machine Inspection",
                "description": "Intermittent point machine response reported.",
                "severity": FaultSeverity.CRITICAL,
                "skill": "SIGNAL_TELECOM",
                "authority": "S&T",
                "estimated_minutes": 75,
                "priority_score": 95.1,
                "priority_reason": "Point failure can block a high-density Mumbai section.",
                "failure_risk": 0.89,
                "train_impact": 10,
                "delay_minutes": 34,
                "km": 31.0,
            },
            {
                "fault_code": "FLT-DEL-001",
                "job_code": "JOB-DEL-001",
                "segment": "SEG-NDLS-AGC",
                "lat": 28.1500,
                "lon": 77.5800,
                "asset": "OVERHEAD_EQUIPMENT",
                "fault_type": "OHE_TENSION_ANOMALY",
                "title": "OHE Tension Inspection",
                "description": "Abnormal contact wire tension trend detected.",
                "severity": FaultSeverity.HIGH,
                "skill": "TRACTION_DISTRIBUTION",
                "authority": "TRD",
                "estimated_minutes": 80,
                "priority_score": 88.4,
                "priority_reason": "Potential traction interruption on trunk route.",
                "failure_risk": 0.76,
                "train_impact": 7,
                "delay_minutes": 22,
                "km": 95.0,
            },
            {
                "fault_code": "FLT-HWH-001",
                "job_code": "JOB-HWH-001",
                "segment": "SEG-HWH-BWN",
                "lat": 22.8900,
                "lon": 88.0800,
                "asset": "DRAINAGE",
                "fault_type": "DRAINAGE_BLOCKAGE",
                "title": "Drainage Clearance",
                "description": "Trackside drainage channel partially blocked.",
                "severity": FaultSeverity.MEDIUM,
                "skill": "CIVIL_TRACK",
                "authority": "ENGINEERING",
                "estimated_minutes": 50,
                "priority_score": 58.0,
                "priority_reason": "Water accumulation risk during rainfall.",
                "failure_risk": 0.31,
                "train_impact": 1,
                "delay_minutes": 4,
                "km": 46.0,
            },
        ]

        for item in jobs:
            segment = segment_by_code[
                item["segment"]
            ]

            fault = FaultEvent(
                fault_code=item["fault_code"],
                track_segment_id=segment.id,
                asset_type=item["asset"],
                fault_type=item["fault_type"],
                description=item["description"],
                severity=item["severity"],
                status=FaultStatus.JOB_CREATED,
                location=point_wkt(
                    item["lat"],
                    item["lon"],
                ),
                km_marker=item["km"],
                detected_source="RAILSYNC_DEMO_EVENT_STREAM",
                detection_confidence=0.91,
                safety_critical=
                    item["severity"]
                    == FaultSeverity.CRITICAL,
                metadata_json={
                    "data_mode":
                        "DEMO_REPLAY",
                    "source_note":
                        "Prototype operational event",
                },
                detected_at=
                    now
                    - timedelta(
                        minutes=20
                    ),
                verified_at=
                    now
                    - timedelta(
                        minutes=10
                    ),
            )

            session.add(fault)

            await session.flush()

            job = MaintenanceJob(
                job_code=item["job_code"],
                fault_id=fault.id,
                track_segment_id=segment.id,
                title=item["title"],
                description=item["description"],
                asset_type=item["asset"],
                job_type=item["fault_type"],
                required_skill=item["skill"],
                required_authority=item["authority"],
                severity=item["severity"],
                status=JobStatus.READY_FOR_ASSIGNMENT,
                location=point_wkt(
                    item["lat"],
                    item["lon"],
                ),
                km_marker=item["km"],
                estimated_minutes=
                    item["estimated_minutes"],
                priority_score=
                    item["priority_score"],
                priority_reason=
                    item["priority_reason"],
                predicted_failure_risk=
                    item["failure_risk"],
                expected_train_impact=
                    item["train_impact"],
                estimated_delay_minutes=
                    item["delay_minutes"],
                block_required=True,
                planned_start=
                    now
                    + timedelta(
                        minutes=30
                    ),
                planned_end=
                    now
                    + timedelta(
                        minutes=
                            30
                            + item[
                                "estimated_minutes"
                            ]
                    ),
            )

            session.add(job)

        # =====================================================
        # WORKER PROFILE FOR EXISTING WORKER LOGIN
        # =====================================================

        worker_user = await get_user_by_email(
            session,
            "worker@railsync.local",
        )

        # Your existing seed may use another email.
        # If not found, try employee login identity later.
        if worker_user:
            worker_profile = WorkerProfile(
                user_id=worker_user.id,
                employee_code="WRK001",
                designation="Senior Track Maintainer",
                department="Engineering / Permanent Way",
                railway_zone="Southern Railway",
                division="Chennai",
                home_station_code="TBM",
                home_station_name="Tambaram",
                current_location=point_wkt(
                    12.9249,
                    80.1275,
                ),
                years_experience=8,
                max_daily_minutes=360,
                is_active=True,
            )

            session.add(worker_profile)

            await session.flush()

            session.add_all(
                [
                    WorkerSkill(
                        worker_id=worker_profile.id,
                        skill_code="TRACK_MAINTENANCE",
                        skill_name="Track Maintenance",
                        authority_code="P-WAY",
                        proficiency_level=5,
                        is_certified=True,
                    ),
                    WorkerSkill(
                        worker_id=worker_profile.id,
                        skill_code="CIVIL_TRACK",
                        skill_name="Civil and Track Maintenance",
                        authority_code="ENGINEERING",
                        proficiency_level=4,
                        is_certified=True,
                    ),
                    WorkerAvailability(
                        worker_id=worker_profile.id,
                        status=WorkerAvailabilityStatus.AVAILABLE,
                        available_from=now,
                        available_until=
                            now
                            + timedelta(
                                hours=6
                            ),
                        reason="On duty",
                    ),
                ]
            )

        await session.commit()

        print("")
        print("======================================")
        print("RailSync operational seed completed")
        print("======================================")
        print(f"Corridors: {len(corridor_data)}")
        print(f"Track segments: {len(segment_data)}")
        print(f"Maintenance jobs: {len(jobs)}")

        if worker_user:
            print("WRK001 profile: created")
        else:
            print(
                "WRK001 profile: skipped because "
                "worker@railsync.in was not found"
            )

        print("Data mode: DEMO_REPLAY")
        print("")


if __name__ == "__main__":
    asyncio.run(main())