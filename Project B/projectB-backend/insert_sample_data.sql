-- Thêm dữ liệu mẫu vào bảng unit
INSERT INTO `unit` (`UnitID`, `CourseID`, `UnitCode`, `UnitName`) VALUES
(1, 1, 'COS40005', 'Computing Technology Inquiry Project'),
(2, 1, 'COS30043', 'Interface Design and Development');

-- Thêm dữ liệu mẫu vào bảng students
INSERT INTO `students` (`StudentID`, `CourseID`, `MajorID`, `RegistrationID`, `FirstName`, `LastName`, `Email`, `Password`) VALUES
(1, 1, 1, '104221559', 'Nghia', 'Trung Doan', 'nghia.doan@student.swin.edu.au', 'password123'),
(2, 1, 1, '104221560', 'John', 'Smith', 'john.smith@student.swin.edu.au', 'password123');

-- Thêm dữ liệu mẫu vào bảng session
INSERT INTO `session` (`SessionID`, `UnitID`, `Date`, `Start`, `End`) VALUES
(1, 1, '2025-10-08', '09:00:00', '11:00:00'),
(2, 1, '2025-10-15', '09:00:00', '11:00:00');

-- Thêm dữ liệu mẫu vào bảng studentunitmap (sinh viên đăng ký unit nào)
INSERT INTO `studentunitmap` (`StudentUnitMapID`, `StudentID`, `UnitID`) VALUES
(1, 1, 1),  -- Nghia đăng ký COS40005
(2, 2, 1);  -- John đăng ký COS40005

-- Thêm dữ liệu mẫu vào bảng attendance
INSERT INTO `attendance` (`AttendanceID`, `StudentID`, `SessionID`, `Status`) VALUES
(1, 1, 1, 'present'),
(2, 2, 1, 'late');