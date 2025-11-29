-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 19, 2025 at 05:43 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `projectb`
--

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `AttendanceID` int(11) NOT NULL,
  `StudentID` int(11) NOT NULL,
  `SessionID` int(11) NOT NULL,
  `Status` enum('present','absent','late','excused','unknown') DEFAULT 'unknown',
  `ActivePoint` int(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance`
--

INSERT INTO `attendance` (`AttendanceID`, `StudentID`, `SessionID`, `Status`, `ActivePoint`) VALUES
(1, 1, 1, 'present', 67),
(2, 2, 1, 'late', 0),
(3, 10, 1, 'absent', 3),
(4, 11, 1, 'absent', 0);

-- --------------------------------------------------------

--
-- Table structure for table `course`
--

CREATE TABLE `course` (
  `CourseID` int(11) NOT NULL,
  `CourseName` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `course`
--

INSERT INTO `course` (`CourseID`, `CourseName`) VALUES
(1, 'Computer Science'),
(2, 'Business'),
(3, 'Media'),
(7, 'Admin');

-- --------------------------------------------------------

--
-- Table structure for table `major`
--

CREATE TABLE `major` (
  `MajorID` int(11) NOT NULL,
  `CourseID` int(11) NOT NULL,
  `MajorName` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `major`
--

INSERT INTO `major` (`MajorID`, `CourseID`, `MajorName`) VALUES
(1, 1, 'Software Development'),
(2, 1, 'Artificial Intelligence'),
(3, 2, 'Marketing'),
(4, 3, 'Social Media and Strategy');

-- --------------------------------------------------------

--
-- Table structure for table `role`
--

CREATE TABLE `role` (
  `RoleID` int(11) NOT NULL,
  `Name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `role`
--

INSERT INTO `role` (`RoleID`, `Name`) VALUES
(1, 'Admin'),
(2, 'Lecturer'),
(3, 'Student');

-- --------------------------------------------------------

--
-- Table structure for table `session`
--

CREATE TABLE `session` (
  `SessionID` int(11) NOT NULL,
  `UnitID` int(11) NOT NULL,
  `Date` date NOT NULL,
  `Start` time DEFAULT NULL,
  `End` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `session`
--

INSERT INTO `session` (`SessionID`, `UnitID`, `Date`, `Start`, `End`) VALUES
(1, 1, '2025-10-08', '09:00:00', '11:00:00'),
(2, 1, '2025-10-15', '09:00:00', '11:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `StudentID` int(11) NOT NULL,
  `CourseID` int(11) DEFAULT NULL,
  `MajorID` int(11) DEFAULT NULL,
  `RegistrationID` varchar(50) DEFAULT NULL,
  `FirstName` varchar(100) DEFAULT NULL,
  `LastName` varchar(100) DEFAULT NULL,
  `Email` varchar(150) DEFAULT NULL,
  `Password` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`StudentID`, `CourseID`, `MajorID`, `RegistrationID`, `FirstName`, `LastName`, `Email`, `Password`) VALUES
(1, 1, 1, '104221559', 'Nghia', 'Trung Doan', 'nghia.doan@student.swin.edu.au', 'password123'),
(2, 1, 1, '104221560', 'John', 'Smith', 'john.smith@student.swin.edu.au', 'password123'),
(3, 1, 2, '104333333', 'Duc', 'Luong Minh', 'example@gmail.com', 'password123'),
(4, 2, 3, '104444444', 'Dung', 'Tran Minh', 'example@gmail.com', 'password123'),
(5, 3, 4, '104555555', 'Son', 'Truong Minh', 'example@gmail.com', 'password123'),
(6, 1, 1, '104666666', 'An', 'Nguyen Van', 'an.nguyen@gmail.com', 'password123'),
(7, 1, 2, '104777777', 'Binh', 'Le Thanh', 'binh.le@gmail.com', 'password123'),
(8, 2, 3, '104888888', 'Chi', 'Pham Thi', 'chi.pham@gmail.com', 'password123'),
(9, 3, 4, '104999999', 'Dao', 'Hoang Minh', 'dao.hoang@gmail.com', 'password123'),
(10, 1, 1, '104182562', 'Dung', 'Tran Minh', 'dungcute@gmail.com', 'password123'),
(11, 1, 2, '104181857', 'Duc', 'Luong Minh', 'ducbasubisu@gmail.com', '1');

-- --------------------------------------------------------

--
-- Table structure for table `studentunitmap`
--

CREATE TABLE `studentunitmap` (
  `StudentUnitMapID` int(11) NOT NULL,
  `StudentID` int(11) NOT NULL,
  `UnitID` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `studentunitmap`
--

INSERT INTO `studentunitmap` (`StudentUnitMapID`, `StudentID`, `UnitID`) VALUES
(1, 1, 1),
(2, 2, 1),
(3, 10, 1),
(4, 11, 1);

-- --------------------------------------------------------

--
-- Table structure for table `unit`
--

CREATE TABLE `unit` (
  `UnitID` int(11) NOT NULL,
  `CourseID` int(11) DEFAULT NULL,
  `UnitCode` varchar(50) NOT NULL,
  `UnitName` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `unit`
--

INSERT INTO `unit` (`UnitID`, `CourseID`, `UnitCode`, `UnitName`) VALUES
(1, 1, 'COS40005', 'Computing Technology Inquiry Project'),
(2, 1, 'COS30043', 'Interface Design and Development'),
(3, 1, 'COS30008', 'Data Structure and Patterns');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `UserID` int(11) NOT NULL,
  `RoleID` int(11) DEFAULT NULL,
  `CourseID` int(11) DEFAULT NULL,
  `FirstName` varchar(100) NOT NULL,
  `LastName` varchar(100) NOT NULL,
  `Email` varchar(150) NOT NULL,
  `Password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`UserID`, `RoleID`, `CourseID`, `FirstName`, `LastName`, `Email`, `Password`) VALUES
(1, 2, 1, 'Ngoc', 'Le', 'leanhngoc3636@gmail.com', 'admin'),
(2, 2, 3, 'Phu', 'Le', 'phule123@gmail.com', 'admin'),
(3, 1, 7, 'Admin', '', 'admin@gmail.com', 'admin'),
(4, 2, 3, 'Huan', 'Rose', 'huanrose36@gmail.com', 'admin');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`AttendanceID`),
  ADD KEY `StudentID` (`StudentID`),
  ADD KEY `SessionID` (`SessionID`);

--
-- Indexes for table `course`
--
ALTER TABLE `course`
  ADD PRIMARY KEY (`CourseID`);

--
-- Indexes for table `major`
--
ALTER TABLE `major`
  ADD PRIMARY KEY (`MajorID`),
  ADD KEY `CourseID` (`CourseID`);

--
-- Indexes for table `role`
--
ALTER TABLE `role`
  ADD PRIMARY KEY (`RoleID`);

--
-- Indexes for table `session`
--
ALTER TABLE `session`
  ADD PRIMARY KEY (`SessionID`),
  ADD KEY `UnitID` (`UnitID`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`StudentID`),
  ADD UNIQUE KEY `RegistrationID` (`RegistrationID`),
  ADD KEY `CourseID` (`CourseID`),
  ADD KEY `MajorID` (`MajorID`);

--
-- Indexes for table `studentunitmap`
--
ALTER TABLE `studentunitmap`
  ADD PRIMARY KEY (`StudentUnitMapID`),
  ADD KEY `StudentID` (`StudentID`),
  ADD KEY `UnitID` (`UnitID`);

--
-- Indexes for table `unit`
--
ALTER TABLE `unit`
  ADD PRIMARY KEY (`UnitID`),
  ADD KEY `CourseID` (`CourseID`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`UserID`),
  ADD UNIQUE KEY `Email` (`Email`),
  ADD KEY `RoleID` (`RoleID`),
  ADD KEY `CourseID` (`CourseID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance`
  MODIFY `AttendanceID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `course`
--
ALTER TABLE `course`
  MODIFY `CourseID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `major`
--
ALTER TABLE `major`
  MODIFY `MajorID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `role`
--
ALTER TABLE `role`
  MODIFY `RoleID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `session`
--
ALTER TABLE `session`
  MODIFY `SessionID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `StudentID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=104182564;

--
-- AUTO_INCREMENT for table `studentunitmap`
--
ALTER TABLE `studentunitmap`
  MODIFY `StudentUnitMapID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `unit`
--
ALTER TABLE `unit`
  MODIFY `UnitID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `UserID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`StudentID`) REFERENCES `students` (`StudentID`),
  ADD CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`SessionID`) REFERENCES `session` (`SessionID`);

--
-- Constraints for table `major`
--
ALTER TABLE `major`
  ADD CONSTRAINT `major_ibfk_1` FOREIGN KEY (`CourseID`) REFERENCES `course` (`CourseID`);

--
-- Constraints for table `session`
--
ALTER TABLE `session`
  ADD CONSTRAINT `session_ibfk_1` FOREIGN KEY (`UnitID`) REFERENCES `unit` (`UnitID`);

--
-- Constraints for table `students`
--
ALTER TABLE `students`
  ADD CONSTRAINT `students_ibfk_1` FOREIGN KEY (`CourseID`) REFERENCES `course` (`CourseID`),
  ADD CONSTRAINT `students_ibfk_2` FOREIGN KEY (`MajorID`) REFERENCES `major` (`MajorID`);

--
-- Constraints for table `studentunitmap`
--
ALTER TABLE `studentunitmap`
  ADD CONSTRAINT `studentunitmap_ibfk_1` FOREIGN KEY (`StudentID`) REFERENCES `students` (`StudentID`),
  ADD CONSTRAINT `studentunitmap_ibfk_2` FOREIGN KEY (`UnitID`) REFERENCES `unit` (`UnitID`);

--
-- Constraints for table `unit`
--
ALTER TABLE `unit`
  ADD CONSTRAINT `unit_ibfk_1` FOREIGN KEY (`CourseID`) REFERENCES `course` (`CourseID`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`RoleID`) REFERENCES `role` (`RoleID`),
  ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`CourseID`) REFERENCES `course` (`CourseID`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
