// src/utils/exportHelpers.js
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableCell, TableRow, WidthType, BorderStyle } from 'docx';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

export class ExportHelper {
  static generateDOCX(lesson) {
    const children = [];

    // Title
    children.push(
      new Paragraph({
        text: lesson.title || 'Untitled Lesson',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Metadata table
    const metadataRows = [
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Grade", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.grade ? lesson.grade.toString() : 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Subject", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.subject || 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Curriculum", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.curriculum || 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Duration", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.duration ? `${lesson.duration} minutes` : 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Template", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: this.formatTemplateName(lesson.template) })] 
          })
        ]
      })
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: metadataRows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        },
      })
    );

    children.push(new Paragraph({ text: "" })); // Empty space

    // Extract and add content from sections
    this.addContentFromSections(children, lesson);
    
    return new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });
  }

  static addContentFromSections(children, lesson) {
    if (!lesson.sections) {
      children.push(
        new Paragraph({
          text: "No content available for this lesson.",
          alignment: AlignmentType.CENTER,
          color: "666666"
        })
      );
      return;
    }

    // Define section display order based on template
    const sectionOrder = this.getSectionOrder(lesson.template);
    
    let hasContent = false;

    for (const sectionName of sectionOrder) {
      const section = lesson.sections[sectionName];
      if (section && section.text && section.text.trim()) {
        hasContent = true;
        
        const displayName = this.formatSectionName(sectionName);
        
        // Add section heading
        children.push(
          new Paragraph({
            text: displayName,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          })
        );

        // Clean and format section content
        const cleanedText = this.cleanFormatting(section.text);
        const paragraphs = cleanedText.split('\n').filter(p => p.trim());
        
        paragraphs.forEach(paragraph => {
          if (paragraph.trim()) {
            // Check if this is a bullet point or numbered item
            if (paragraph.match(/^[\*•\-]\s/) || paragraph.match(/^\d+\.\s/)) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "• ",
                      bold: true
                    }),
                    new TextRun({
                      text: paragraph.replace(/^[\*•\-]\s/, '').replace(/^\d+\.\s/, '')
                    })
                  ],
                  spacing: { after: 80 },
                  indent: { left: 200 }
                })
              );
            } 
            // Check if this is a subheading (contains **)
            else if (paragraph.includes('**') && paragraph.replace(/\*/g, '').trim().length > 0) {
              const cleanText = paragraph.replace(/\*/g, '').trim();
              children.push(
                new Paragraph({
                  text: cleanText,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 200, after: 100 }
                })
              );
            }
            // Regular paragraph
            else {
              children.push(
                new Paragraph({
                  text: paragraph.trim(),
                  spacing: { after: 100 }
                })
              );
            }
          }
        });

        // Add some space after section
        children.push(new Paragraph({ text: "" }));
      }
    }

    // If no sections have content, show message
    if (!hasContent) {
      children.push(
        new Paragraph({
          text: "No content available for this lesson.",
          alignment: AlignmentType.CENTER,
          color: "666666"
        })
      );
    }
  }

  static cleanFormatting(text) {
    if (!text) return '';
    
    // Remove multiple asterisks but keep the content
    let cleaned = text
      .replace(/\*\*\*/g, '') // Remove triple asterisks
      .replace(/\*\*/g, '')   // Remove double asterisks
      .replace(/\*/g, '')     // Remove single asterisks
      .replace(/\-\-\-/g, '') // Remove triple dashes
      .replace(/\-\-/g, '')   // Remove double dashes
      .trim();
    
    // Clean up table formatting artifacts
    cleaned = cleaned.replace(/\|\s*\-\-/g, '') // Remove table formatting lines
                    .replace(/\-\-\|\s*/g, '') 
                    .replace(/\|\s*/g, ' | ')   // Improve table readability
                    .replace(/\s+\|\s+/g, ' | ');
    
    // Remove excessive empty lines
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return cleaned;
  }

  static getSectionOrder(template) {
    const templateSpecific = {
      lesson_plan: [
        'objectives', 'priorKnowledge', 'warmup', 'introduction', 
        'mainActivities', 'assessment', 'resources', 'differentiation', 
        'homework', 'notes'
      ],
      gagne_lesson_plan: [
        'objectives', 'gainAttention', 'informObjectives', 'stimulateRecall',
        'presentContent', 'provideGuidance', 'elicitPerformance', 
        'provideFeedback', 'assessPerformance', 'enhanceRetention',
        'resources', 'differentiation'
      ],
      quiz: [
        'objectives', 'questions', 'answerKey', 'assessment', 
        'resources', 'differentiation'
      ],
      project: [
        'objectives', 'materials', 'procedure', 'timeline',
        'outcomes', 'evaluation', 'resources'
      ],
      debate: [
        'objectives', 'topic', 'forArguments', 'againstArguments',
        'moderatorGuidelines', 'evaluationCriteria', 'timingStructure',
        'researchGuidelines', 'resources'
      ],
      unit_plan: [
        'objectives', 'activities', 'assessment', 'resources',
        'differentiation', 'notes'
      ]
    };

    return templateSpecific[template] || Object.keys(templateSpecific.debate);
  }

  static formatSectionName(sectionName) {
    const nameMap = {
      // Common sections
      objectives: 'Learning Objectives',
      activities: 'Activities',
      assessment: 'Assessment',
      resources: 'Resources & Materials',
      differentiation: 'Differentiation Strategies',
      notes: 'Additional Notes',
      
      // Lesson plan specific
      priorKnowledge: 'Prior Knowledge',
      warmup: 'Warm-up Activity',
      introduction: 'Introduction',
      mainActivities: 'Main Activities',
      homework: 'Homework & Extension',
      
      // Gagné specific
      gainAttention: '1. Gain Attention',
      informObjectives: '2. Inform Objectives',
      stimulateRecall: '3. Stimulate Recall',
      presentContent: '4. Present Content',
      provideGuidance: '5. Provide Guidance',
      elicitPerformance: '6. Elicit Performance',
      provideFeedback: '7. Provide Feedback',
      assessPerformance: '8. Assess Performance',
      enhanceRetention: '9. Enhance Retention',
      
      // Quiz specific
      questions: 'Questions',
      answerKey: 'Answer Key',
      
      // Project specific
      procedure: 'Procedure',
      materials: 'Materials',
      outcomes: 'Expected Outcomes',
      evaluation: 'Evaluation Criteria',
      timeline: 'Timeline',
      
      // Debate specific
      topic: 'Debate Topic',
      forArguments: 'Arguments For (PROS)',
      againstArguments: 'Arguments Against (CONS)',
      moderatorGuidelines: 'Moderator Guidelines',
      evaluationCriteria: 'Evaluation Criteria',
      timingStructure: 'Timing Structure',
      researchGuidelines: 'Research Guidelines'
    };

    return nameMap[sectionName] || this.formatKey(sectionName);
  }

  static formatTemplateName(template) {
    const nameMap = {
      lesson_plan: 'Lesson Plan',
      unit_plan: 'Unit Plan',
      quiz: 'Quiz',
      project: 'Project',
      gagne_lesson_plan: 'Gagné Lesson Plan',
      debate: 'Debate',
      blank: 'Blank Template'
    };
    return nameMap[template] || template;
  }

  static formatKey(key) {
    return key.split(/(?=[A-Z])/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  static async generatePDF(lesson) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margin: 50,
          size: 'A4',
          info: {
            Title: lesson.title || 'Lesson Plan',
            Author: 'Lesson Planner',
            Subject: lesson.subject || 'Education'
          }
        });
        
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Title
        doc.fontSize(20).font('Helvetica-Bold')
           .text(lesson.title || 'Untitled Lesson', { align: 'center' })
           .moveDown(0.5);

        // Metadata
        doc.fontSize(10).font('Helvetica')
           .text(`Grade: ${lesson.grade || 'Not specified'}`, { align: 'center' })
           .text(`Subject: ${lesson.subject || 'Not specified'}`, { align: 'center' })
           .text(`Curriculum: ${lesson.curriculum || 'Not specified'}`, { align: 'center' })
           .text(`Duration: ${lesson.duration ? `${lesson.duration} minutes` : 'Not specified'}`, { align: 'center' })
           .text(`Template: ${this.formatTemplateName(lesson.template)}`, { align: 'center' })
           .moveDown();

        // Add horizontal line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
           .moveDown();

        // Add content from sections
        this.addPDFContentFromSections(doc, lesson);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  static addPDFContentFromSections(doc, lesson) {
    if (!lesson.sections) {
      doc.fontSize(12).font('Helvetica')
         .text('No content available for this lesson.', { align: 'center' });
      return;
    }

    const sectionOrder = this.getSectionOrder(lesson.template);
    let hasContent = false;

    for (const sectionName of sectionOrder) {
      const section = lesson.sections[sectionName];
      if (section && section.text && section.text.trim()) {
        hasContent = true;
        
        const displayName = this.formatSectionName(sectionName);
        
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }
        
        // Add section heading
        doc.fontSize(14).font('Helvetica-Bold')
           .text(displayName, { underline: true })
           .moveDown(0.3);

        // Clean and format section content
        const cleanedText = this.cleanFormatting(section.text);
        const paragraphs = cleanedText.split('\n').filter(p => p.trim());
        
        doc.fontSize(10).font('Helvetica');
        
        paragraphs.forEach(paragraph => {
          if (paragraph.trim()) {
            // Check if this is a bullet point
            if (paragraph.match(/^[\*•\-]\s/) || paragraph.match(/^\d+\.\s/)) {
              const bulletText = paragraph.replace(/^[\*•\-]\s/, '').replace(/^\d+\.\s/, '');
              doc.text(`• ${bulletText}`, { indent: 20, align: 'left' });
            } else {
              doc.text(paragraph.trim(), { align: 'left' });
            }
            doc.moveDown(0.2);
          }
        });

        doc.moveDown(0.5);
      }
    }

    if (!hasContent) {
      doc.fontSize(12).font('Helvetica')
         .text('No content available for this lesson.', { align: 'center' });
    }
  }

  static async generatePPTX(lesson) {
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.title = lesson.title || 'Lesson Plan';
    pptx.author = 'Lesson Planner';
    
    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(lesson.title || 'Untitled Lesson', {
      x: 0.5, y: 1.5, w: 9, h: 1.5,
      fontSize: 24, bold: true, align: "center",
      color: "000000"
    });
    
    titleSlide.addText(
      `Grade: ${lesson.grade || 'N/A'}\nSubject: ${lesson.subject || 'N/A'}\nCurriculum: ${lesson.curriculum || 'N/A'}\nDuration: ${lesson.duration || 'N/A'} minutes\nTemplate: ${this.formatTemplateName(lesson.template)}`,
      { 
        x: 0.5, y: 3.0, w: 9, h: 2,
        fontSize: 14, align: "center", 
        color: "444444",
        lineSpacing: 1.2
      }
    );

    // Add slides for each section with content
    if (lesson.sections) {
      const sectionOrder = this.getSectionOrder(lesson.template);
      
      for (const sectionName of sectionOrder) {
        const section = lesson.sections[sectionName];
        if (section && section.text && section.text.trim()) {
          const displayName = this.formatSectionName(sectionName);
          const cleanedText = this.cleanFormatting(section.text);
          
          const contentSlide = pptx.addSlide();
          
          // Add section title
          contentSlide.addText(displayName, {
            x: 0.5, y: 0.5, w: 9, h: 0.8,
            fontSize: 20, bold: true,
            color: "000000",
            align: "left"
          });

          // Format content for PPT
          let formattedContent = cleanedText;
          
          // Truncate content if too long for slide
          if (formattedContent.length > 1500) {
            formattedContent = formattedContent.substring(0, 1500) + '...\n\n[Content truncated for presentation]';
          }

          // Add content with proper formatting
          contentSlide.addText(formattedContent, {
            x: 0.5, y: 1.5, w: 9, h: 5.5,
            fontSize: 12,
            color: "333333",
            align: "left",
            lineSpacing: 1.3,
            bullet: false,
            margin: [0.1, 0.1, 0.1, 0.1]
          });
        }
      }
    }

    // If no content, add a placeholder slide
    if (!lesson.sections || Object.keys(lesson.sections).length === 0) {
      const placeholderSlide = pptx.addSlide();
      placeholderSlide.addText("No Content Available", {
        x: 0.5, y: 2.5, w: 9, h: 2,
        fontSize: 18, align: "center", color: "666666"
      });
    }

    return pptx.write('base64').then(base64 => Buffer.from(base64, 'base64'));
  }
}