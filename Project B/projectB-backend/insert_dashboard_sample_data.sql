-- Insert sample attendance data for dashboard testing
INSERT INTO `attendance` (`AttendanceID`, `StudentID`, `SessionID`, `Status`) VALUES
(1, 1, 1, 'present'),
(2, 2, 1, 'present'),
(3, 3, 1, 'absent'),
(4, 4, 1, 'late'),
(5, 5, 1, 'present'),
(6, 1, 2, 'absent'),
(7, 2, 2, 'present'),
(8, 3, 2, 'present'),
(9, 4, 2, 'present'),
(10, 5, 2, 'late');

-- Insert sample sessions
INSERT INTO `session` (`SessionID`, `UnitID`, `Date`, `Start`, `End`) VALUES
(1, 1, '2025-10-08', '09:00:00', '11:00:00'),
(2, 1, '2025-10-09', '09:00:00', '11:00:00'),
(3, 2, '2025-10-08', '13:00:00', '15:00:00'),
(4, 2, '2025-10-09', '13:00:00', '15:00:00');

-- Insert sample units
INSERT INTO `unit` (`UnitID`, `CourseID`, `UnitCode`, `UnitName`) VALUES
(1, 1, 'COS10001', 'Problem Solving with ICT'),
(2, 1, 'COS10003', 'Computer and Logic Essentials'),
(3, 2, 'BUS10001', 'Business Fundamentals'),
(4, 3, 'MED10001', 'Media Production');