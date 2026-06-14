import { getPool } from '../db.js';

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
    `,
    [tableName]
  );
  return rows[0].count > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
    `,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (!(await columnExists(connection, tableName, columnName))) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function migrate() {
  const connection = await getPool().getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS units (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        grade_level VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS grammar_points (
        id INT PRIMARY KEY AUTO_INCREMENT,
        unit_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        notes_content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_grammar_points_unit FOREIGN KEY (unit_id) REFERENCES units(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await addColumnIfMissing(connection, 'grammar_points', 'notes_content', 'TEXT');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS corpus (
        id INT PRIMARY KEY AUTO_INCREMENT,
        unit_id INT NOT NULL,
        grammar_point_id INT NOT NULL,
        question_type ENUM('collocation','translation','synonym','analogy','morphology','phrase') NOT NULL,
        question_text TEXT NOT NULL,
        acceptable_answers JSON NOT NULL,
        template TEXT,
        match_rule VARCHAR(50) DEFAULT 'exact',
        requires_ai BOOLEAN DEFAULT FALSE,
        difficulty TINYINT DEFAULT 1,
        source_key VARCHAR(120),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_corpus_unit FOREIGN KEY (unit_id) REFERENCES units(id),
        CONSTRAINT fk_corpus_grammar_point FOREIGN KEY (grammar_point_id) REFERENCES grammar_points(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await addColumnIfMissing(connection, 'corpus', 'source_key', 'VARCHAR(120)');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS knowledge_graphs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        grammar_point_id INT NOT NULL,
        graph_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_graph_grammar_point FOREIGN KEY (grammar_point_id) REFERENCES grammar_points(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS quiz_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        unit_id INT NOT NULL,
        student_name VARCHAR(80) DEFAULT '匿名学生',
        total_questions INT NOT NULL,
        correct_count INT NOT NULL,
        score INT NOT NULL,
        mode ENUM('student','teacher') DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_quiz_records_unit FOREIGN KEY (unit_id) REFERENCES units(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS quiz_record_answers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        quiz_record_id INT NOT NULL,
        corpus_id INT NOT NULL,
        question_type VARCHAR(40) NOT NULL,
        user_answer TEXT,
        is_correct BOOLEAN DEFAULT FALSE,
        score INT DEFAULT 0,
        feedback VARCHAR(255),
        correct_answers JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_quiz_answers_record FOREIGN KEY (quiz_record_id) REFERENCES quiz_records(id),
        CONSTRAINT fk_quiz_answers_corpus FOREIGN KEY (corpus_id) REFERENCES corpus(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS classroom_corpus (
        id INT PRIMARY KEY AUTO_INCREMENT,
        english VARCHAR(200) NOT NULL,
        chinese VARCHAR(200),
        english_explain TEXT,
        phonetic VARCHAR(100),
        tags JSON,
        group_name VARCHAR(100) NOT NULL,
        sort_order INT DEFAULT 0,
        source_key VARCHAR(120),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS classroom_knowledge_graphs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        group_name VARCHAR(100) NOT NULL,
        graph_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const indexStatements = [
      ['units', 'uniq_units_name_grade', 'ALTER TABLE units ADD UNIQUE KEY uniq_units_name_grade (name, grade_level)'],
      [
        'grammar_points',
        'uniq_grammar_unit_name',
        'ALTER TABLE grammar_points ADD UNIQUE KEY uniq_grammar_unit_name (unit_id, name)'
      ],
      ['corpus', 'idx_corpus_unit', 'ALTER TABLE corpus ADD KEY idx_corpus_unit (unit_id)'],
      ['corpus', 'idx_corpus_grammar', 'ALTER TABLE corpus ADD KEY idx_corpus_grammar (grammar_point_id)'],
      ['corpus', 'uniq_corpus_source_key', 'ALTER TABLE corpus ADD UNIQUE KEY uniq_corpus_source_key (source_key)'],
      [
        'knowledge_graphs',
        'uniq_graph_grammar_point',
        'ALTER TABLE knowledge_graphs ADD UNIQUE KEY uniq_graph_grammar_point (grammar_point_id)'
      ],
      [
        'classroom_corpus',
        'uniq_classroom_corpus_source_key',
        'ALTER TABLE classroom_corpus ADD UNIQUE KEY uniq_classroom_corpus_source_key (source_key)'
      ],
      [
        'classroom_corpus',
        'idx_classroom_corpus_group',
        'ALTER TABLE classroom_corpus ADD KEY idx_classroom_corpus_group (group_name, sort_order)'
      ],
      [
        'classroom_knowledge_graphs',
        'uniq_classroom_graph_group',
        'ALTER TABLE classroom_knowledge_graphs ADD UNIQUE KEY uniq_classroom_graph_group (group_name)'
      ]
    ];

    for (const [tableName, indexName, statement] of indexStatements) {
      if ((await tableExists(connection, tableName)) && !(await indexExists(connection, tableName, indexName))) {
        await connection.query(statement);
      }
    }

    console.log('Database migration complete.');
  } finally {
    connection.release();
    await getPool().end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
