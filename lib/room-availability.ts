export const ROOM_AVAILABILITY_SQL = `SELECT u.room_number FROM room_units u JOIN rooms r ON r.id=u.room_id
      WHERE r.id=$1 AND r.is_active AND u.is_active AND NOT EXISTS (
        SELECT 1 FROM bookings b WHERE b.room_id=r.id AND b.status IN ('pending','confirmed','checked_in')
        AND (b.assigned_room_number=u.room_number OR b.assigned_room_number IS NULL)
        AND daterange(b.check_in,b.check_out,'[)') && daterange($2::date,$3::date,'[)'))
      ORDER BY u.room_number`;
