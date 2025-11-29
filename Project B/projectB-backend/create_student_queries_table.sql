-- Tạo bảng student_queries để lưu các câu hỏi của sinh viên về điểm danh

CREATE TABLE IF NOT EXISTS `student_queries` (
  `QueryID` int(11) NOT NULL AUTO_INCREMENT,
  `StudentID` int(11) NOT NULL,
  `Subject` varchar(200) NOT NULL,
  `Message` text NOT NULL,
  `SessionID` int(11) DEFAULT NULL,
  `Status` enum('pending','responded','resolved') DEFAULT 'pending',
  `Response` text DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `RespondedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`QueryID`),
  KEY `StudentID` (`StudentID`),
  KEY `SessionID` (`SessionID`),
  CONSTRAINT `student_queries_ibfk_1` FOREIGN KEY (`StudentID`) REFERENCES `students` (`StudentID`) ON DELETE CASCADE,
  CONSTRAINT `student_queries_ibfk_2` FOREIGN KEY (`SessionID`) REFERENCES `session` (`SessionID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Thêm dữ liệu mẫu (SessionID để NULL vì không bắt buộc)
INSERT INTO `student_queries` (`StudentID`, `Subject`, `Message`, `SessionID`, `Status`, `CreatedAt`)
VALUES 
(1, 'Missing attendance record', 'I attended the session on 2025-10-08 but my attendance was not recorded. Can you please check?', NULL, 'pending', NOW()),
(2, 'Incorrect Active Point', 'My active point seems lower than expected. I participated actively in class.', NULL, 'responded', NOW());

-- Thêm response cho query thứ 2
UPDATE `student_queries` 
SET `Response` = 'Thank you for your query. We have reviewed the session recording and updated your active point accordingly. Your new active point is 75.', 
    `RespondedAt` = NOW(),
    `Status` = 'responded'
WHERE `QueryID` = 2;
